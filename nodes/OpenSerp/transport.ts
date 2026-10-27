import { NodeApiError, type IDataObject, type IExecuteFunctions } from 'n8n-workflow';

export type Engine = 'google' | 'bing' | 'duckduckgo' | 'ecosia' | 'yandex' | 'baidu';
export type MegaMode = 'balanced' | 'any' | 'fast';
export type ExtractMode = 'auto' | 'fast' | 'rendered';
type QueryValue = string | number | boolean | string[] | undefined;
type QueryParams = Record<string, QueryValue>;
export type SearchParams = QueryParams & { engine: Engine };
export type ImageParams = SearchParams;
export type MegaSearchParams = QueryParams & { engines?: Engine[]; mode?: MegaMode };
export type MegaImageParams = MegaSearchParams;
export type ExtractParams = QueryParams & { url: string };
export type BatchExtractParams = QueryParams & { urls: string[] };

export interface OpenSerpConfig {
	apiKey?: string | undefined;
	baseUrl?: string | undefined;
	timeoutMs?: number | undefined;
}

interface ResponseMeta {
	status: number;
	requestId?: string | undefined;
	credits?: IDataObject | undefined;
	engineUsed?: string | undefined;
	networkBytes?: number | undefined;
}

interface HttpResponse {
	statusCode: number;
	headers: Record<string, unknown>;
	body: unknown;
}

function apiError(context: IExecuteFunctions, message: string, status = 0, code?: string, requestId?: string, retryAfter?: number): NodeApiError {
	const error = new NodeApiError(context.getNode(), { message }, { message, httpCode: String(status) });
	error.context.openserp = Object.fromEntries(Object.entries({
		status, code, request_id: requestId, retry_after: retryAfter,
	}).filter(([, value]) => value !== undefined));
	return error;
}

export function errorDetails(error: unknown): IDataObject {
	return error instanceof NodeApiError ? (error.context.openserp ?? {}) as IDataObject : {};
}

export class OpenSerpClient {
	lastResponse?: ResponseMeta;

	constructor(
		private readonly context: IExecuteFunctions,
		private readonly config: OpenSerpConfig,
	) {}

	search({ engine, ...params }: SearchParams): Promise<unknown> {
		return this.request(`/${engine}/search`, params);
	}

	image({ engine, ...params }: ImageParams): Promise<unknown> {
		return this.request(`/${engine}/image`, params);
	}

	megaSearch(params: MegaSearchParams): Promise<unknown> {
		return this.request('/mega/search', params);
	}

	megaImage(params: MegaImageParams): Promise<unknown> {
		return this.request('/mega/image', params);
	}

	extract(params: ExtractParams): Promise<unknown> {
		return this.request('/extract', params);
	}

	async batchExtract(params: BatchExtractParams): Promise<unknown> {
		const response = await this.request('/extract/batch', params, 'POST');
		if (!Array.isArray(response)) return response;

		// OSS returns a bare array; keep the Cloud envelope for downstream nodes.
		const results = response.map((item: IDataObject) => {
			const metadata = item.metadata as IDataObject | undefined;
			return { ...item, url: metadata?.source, error: metadata?.error || undefined };
		});
		const failed = results.filter((item) => item.error).length;
		return { results, meta: { requested: results.length, succeeded: results.length - failed, failed } };
	}

	me(): Promise<unknown> {
		return this.cloudRequest('/me', 'me');
	}

	pricing(): Promise<unknown> {
		return this.cloudRequest('/pricing', 'pricing');
	}

	enginesCapabilities(): Promise<unknown> {
		return this.cloudRequest('/engines/capabilities', 'enginesCapabilities');
	}

	enginesStatus(): Promise<unknown> {
		return this.cloudRequest('/engines/status', 'enginesStatus');
	}

	private cloudRequest(path: string, operation: string): Promise<unknown> {
		const isCloud = this.config.apiKey ||
			(this.config.baseUrl && new URL(this.config.baseUrl).hostname === 'api.openserp.org');
		if (!isCloud) {
			throw apiError(this.context,
				`${operation} is only available against OpenSERP Cloud. Configure an API key and the Cloud base URL. Get an API key: https://openserp.org/dashboard/keys`,
			);
		}
		return this.request(path);
	}

	private async request(path: string, params: QueryParams = {}, method: 'GET' | 'POST' = 'GET'): Promise<unknown> {
		const baseUrl = this.config.baseUrl ||
			(this.config.apiKey ? 'https://api.openserp.org/v1' : 'http://localhost:7000');
		const url = new URL(`${baseUrl.replace(/\/+$/, '')}${path}`);
		const payload: IDataObject = {};
		const names: Record<string, string> = {
			extractMode: 'extract_mode', minRunes: 'min_runes', useLlmsTxt: 'use_llms_txt',
		};
		for (const [key, value] of Object.entries(params)) {
			if (value === undefined) continue;
			const name = names[key] ?? key;
			if (method === 'POST') payload[name] = value;
			else url.searchParams.set(name, Array.isArray(value) ? value.join(',') : String(value));
		}

		const timeout = this.config.timeoutMs ?? 30000;
		let response: HttpResponse;
		try {
			response = await this.context.helpers.httpRequest({
				method,
				url: url.toString(),
				headers: {
					Accept: 'application/json',
					'X-OpenSERP-Client': 'n8n',
					...(this.config.apiKey ? { Authorization: `Bearer ${this.config.apiKey}` } : {}),
					...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
				},
				...(method === 'POST' ? { body: JSON.stringify(payload) } : {}),
				timeout,
				encoding: 'text',
				returnFullResponse: true,
				ignoreHttpStatusErrors: true,
				sendCredentialsOnCrossOriginRedirect: false,
			}) as HttpResponse;
		} catch (error) {
			const code = (error as { code?: string } | null)?.code;
			const failure = code === 'ETIMEDOUT' || code === 'ECONNABORTED'
				? apiError(this.context, `OpenSERP request timed out after ${timeout}ms`, 0, 'request_timeout')
				: new NodeApiError(this.context.getNode(), { message: error instanceof Error ? error.message : String(error) });
			throw failure;
		}

		const header = (name: string): string | undefined => {
			const value = Object.entries(response.headers).find(([key]) => key.toLowerCase() === name)?.[1];
			return value === undefined ? undefined : String(value);
		};
		const used = numberValue(header('x-credits-used'));
		const remaining = numberValue(header('x-credits-remaining'));
		this.lastResponse = {
			status: response.statusCode,
			requestId: header('x-request-id'),
			credits: used === undefined && remaining === undefined ? undefined : { used, remaining },
			engineUsed: header('x-engine-used'),
			networkBytes: numberValue(header('x-network-bytes')),
		};
		const body = parseBody(response.body);
		if (response.statusCode < 200 || response.statusCode >= 300) {
			const data = body && typeof body === 'object' && 'error' in body ? body as IDataObject : {};
			throw apiError(this.context,
				typeof data.message === 'string' ? data.message : `OpenSERP request failed with status ${response.statusCode}`,
				response.statusCode,
				typeof data.error === 'string' ? data.error : undefined,
				typeof data.request_id === 'string' ? data.request_id : header('x-request-id'),
				retryDelay(header('retry-after')) ?? retryDelay(data.retry_after),
			);
		}
		return body;
	}
}

function parseBody(body: unknown): unknown {
	if (typeof body !== 'string') return body;
	if (!body) return undefined;
	try {
		return JSON.parse(body);
	} catch {
		return body;
	}
}

function numberValue(value: unknown): number | undefined {
	if (value === undefined || value === null || value === '') return undefined;
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : undefined;
}

function retryDelay(value: unknown): number | undefined {
	if (typeof value !== 'string' && typeof value !== 'number') return undefined;
	if (typeof value === 'string' && value.trim() === '') return undefined;
	const seconds = Number(value);
	return Number.isFinite(seconds) && seconds >= 0 ? seconds : undefined;
}
