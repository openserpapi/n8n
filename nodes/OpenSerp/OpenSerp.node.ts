import { OpenSERP, SERPError } from '@openserp/sdk';
import type {
	BatchExtractParams,
	Engine,
	ExtractMode,
	ExtractParams,
	ImageParams,
	MegaImageParams,
	MegaMode,
	MegaSearchParams,
	OpenSERPConfig,
	SearchParams,
} from '@openserp/sdk';
import {
	NodeOperationError,
	type ICredentialDataDecryptedObject,
	type IExecuteFunctions,
	type IDataObject,
	type INodeExecutionData,
	type INodeProperties,
	type INodeType,
	type INodeTypeDescription,
} from 'n8n-workflow';

type Resource = 'search' | 'image' | 'extract' | 'account' | 'engines';
type SearchOperation = 'single' | 'mega';
type ImageOperation = 'single' | 'mega';
type ExtractOperation = 'getContent' | 'getContentBatch';
type AccountOperation = 'getMe' | 'pricing';
type EnginesOperation = 'capabilities' | 'status';

const ENGINE_OPTIONS = [
	{ name: 'Google', value: 'google' },
	{ name: 'Bing', value: 'bing' },
	{ name: 'DuckDuckGo', value: 'duckduckgo' },
	{ name: 'Ecosia', value: 'ecosia' },
	{ name: 'Yandex', value: 'yandex' },
	{ name: 'Baidu', value: 'baidu' },
];

const MODE_OPTIONS = [
	{ name: 'Balanced', value: 'balanced', description: 'Query selected engines and merge results' },
	{ name: 'Any', value: 'any', description: 'Return the first successful engine result' },
	{ name: 'Fast', value: 'fast', description: 'Prioritize healthy, fast engines and return the first successful result' },
];

const EXTRACT_MODE_OPTIONS = [
	{ name: 'Auto', value: 'auto' },
	{ name: 'Fast', value: 'fast' },
	{ name: 'Rendered', value: 'rendered' },
];

const SUPPORT_HINT =
	'OpenSERP docs: https://openserp.org/docs | GitHub issues: https://github.com/openserpapi/n8n/issues';

const searchDisplay = {
	show: {
		resource: ['search'],
	},
};

const imageDisplay = {
	show: {
		resource: ['image'],
	},
};

const searchSingleDisplay = {
	show: {
		resource: ['search'],
		operation: ['single'],
	},
};

const searchMegaDisplay = {
	show: {
		resource: ['search'],
		operation: ['mega'],
	},
};

const imageSingleDisplay = {
	show: {
		resource: ['image'],
		operation: ['single'],
	},
};

const imageMegaDisplay = {
	show: {
		resource: ['image'],
		operation: ['mega'],
	},
};

const commonQueryProperties: INodeProperties[] = [
	{
		displayName: 'Query',
		name: 'text',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'openserp',
		description:
			'Search query text. When used as an AI Agent tool, this is the main parameter to let the model fill.',
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		default: 50,
		typeOptions: {
			minValue: 1,
		},
		description: 'Max number of results to return',
	},
	{
		displayName: 'Region',
		name: 'region',
		type: 'string',
		default: '',
		placeholder: 'US',
		description: 'Market or location hint, such as US, DE, en-GB, or a city name',
	},
	{
		displayName: 'Language',
		name: 'lang',
		type: 'string',
		default: '',
		placeholder: 'EN',
		description: 'Engine-specific language code',
	},
	{
		displayName: 'Additional Options',
		name: 'additionalOptions',
		type: 'collection',
		placeholder: 'Add option',
		default: {},
		options: [
			{
				displayName: 'Date Range',
				name: 'date',
				type: 'string',
				default: '',
				placeholder: '20250101..20250131',
				description: 'Published-date range YYYYMMDD..YYYYMMDD. Cloud web search: Google and Ecosia only; unsupported filters return 400 without charge.',
			},
			{
				displayName: 'File Extension',
				name: 'file',
				type: 'string',
				default: '',
				placeholder: 'PDF',
				description: 'File extension filter, for engines that support it',
			},
			{
				displayName: 'Filter Duplicates',
				name: 'filter',
				type: 'boolean',
				default: true,
				description: 'Whether to ask OpenSERP to filter duplicate results when supported',
			},
			{
				displayName: 'Include SERP Features',
				name: 'features',
				type: 'boolean',
				default: true,
				description: 'Whether to include answer boxes, related searches, and similar SERP features when supported',
			},
			{
				displayName: 'Site',
				name: 'site',
				type: 'string',
				default: '',
				placeholder: 'example.com',
				description: 'Restrict results to a domain or site',
			},
			{
				displayName: 'Start',
				name: 'start',
				type: 'number',
				default: 0,
				typeOptions: {
					minValue: 0,
				},
				description: 'Result offset. Cloud: use multiples of 10 for Google, Bing, Yandex; Baidu supports early pages, Ecosia any offset, DuckDuckGo none. Balanced mega requires 0.',
			},
		],
	},
];

export class OpenSerp implements INodeType {
  description: INodeTypeDescription = {
    displayName: "OpenSERP",
    name: "openSerp",
    icon: "file:openserp.svg",
    group: ["transform"],
    version: 1,
    subtitle: '={{$parameter["resource"] + ": " + $parameter["operation"]}}',
    description:
      "Search the web, search images, extract pages, and inspect OpenSERP Cloud account or engine status. Docs: https://openserp.org/docs. Source and issues: https://github.com/openserpapi/n8n/issues.",
    defaults: {
      name: "OpenSERP",
    },
    usableAsTool: true,
    inputs: ["main"],
    outputs: ["main"],
    credentials: [
      {
        name: "openSerpApi",
        required: true,
      },
    ],
    properties: [
      {
        displayName: "Resource",
        name: "resource",
        type: "options",
        noDataExpression: true,
        default: "search",
        options: [
          {
            name: "Account",
            value: "account",
            description: "Read OpenSERP Cloud account and pricing data",
          },
          {
            name: "Engine",
            value: "engines",
            description: "Read OpenSERP Cloud engine capabilities and status",
          },
          {
            name: "Extract",
            value: "extract",
            description: "Extract readable content from a URL",
          },
          {
            name: "Image",
            value: "image",
            description: "Search image results",
          },
          {
            name: "Search",
            value: "search",
            description: "Search web results",
          },
        ],
      },
      {
        displayName: "Operation",
        name: "operation",
        type: "options",
        noDataExpression: true,
        default: "single",
        displayOptions: searchDisplay,
        options: [
          {
            name: "Single",
            value: "single",
            description: "Search with one engine",
            action: "Search with one engine",
          },
          {
            name: "Mega",
            value: "mega",
            description: "Search across multiple engines",
            action: "Search across multiple engines",
          },
        ],
      },
      {
        displayName: "Operation",
        name: "operation",
        type: "options",
        noDataExpression: true,
        default: "single",
        displayOptions: imageDisplay,
        options: [
          {
            name: "Single",
            value: "single",
            description: "Search images with one engine",
            action: "Search images with one engine",
          },
          {
            name: "Mega",
            value: "mega",
            description: "Search images across multiple engines",
            action: "Search images across multiple engines",
          },
        ],
      },
      {
        displayName: "Operation",
        name: "operation",
        type: "options",
        noDataExpression: true,
        default: "getContent",
        displayOptions: {
          show: {
            resource: ["extract"],
          },
        },
        options: [
          {
            name: "Get Content",
            value: "getContent",
            description: "Extract readable content from a URL",
            action: "Extract readable content from a URL",
          },
          {
            name: "Get Content (Many URLs)",
            value: "getContentBatch",
            description: "Extract readable content from up to 20 URLs in one request",
            action: "Extract readable content from many pages",
          },
        ],
      },
      {
        displayName: "Operation",
        name: "operation",
        type: "options",
        noDataExpression: true,
        default: "getMe",
        displayOptions: {
          show: {
            resource: ["account"],
          },
        },
        options: [
          {
            name: "Get Me",
            value: "getMe",
            description: "Get the current OpenSERP Cloud account",
            action: "Get current account",
          },
          {
            name: "Get Pricing",
            value: "pricing",
            description: "Get OpenSERP Cloud pricing metadata",
            action: "Get pricing metadata",
          },
        ],
      },
      {
        displayName: "Operation",
        name: "operation",
        type: "options",
        noDataExpression: true,
        default: "capabilities",
        displayOptions: {
          show: {
            resource: ["engines"],
          },
        },
        options: [
          {
            name: "Get Capabilities",
            value: "capabilities",
            description: "Get engine capability metadata",
            action: "Get engine capabilities",
          },
          {
            name: "Get Status",
            value: "status",
            description: "Get current engine status metadata",
            action: "Get engine status",
          },
        ],
      },
      {
        displayName: "Engine",
        name: "engine",
        type: "options",
        default: "google",
        displayOptions: {
          show: {
            resource: ["search", "image"],
            operation: ["single"],
          },
        },
        options: ENGINE_OPTIONS,
        description: "Search engine to query",
      },
      {
        displayName: "Engines",
        name: "engines",
        type: "multiOptions",
        default: [],
        displayOptions: {
          show: {
            resource: ["search", "image"],
            operation: ["mega"],
          },
        },
        options: ENGINE_OPTIONS,
        description: "Engines to query. Leave empty to use all available engines.",
      },
      {
        displayName: "Mode",
        name: "mode",
        type: "options",
        default: "balanced",
        displayOptions: {
          show: {
            resource: ["search", "image"],
            operation: ["mega"],
          },
        },
        options: MODE_OPTIONS,
        description: "Execution strategy for multi-engine requests",
      },
      ...commonQueryProperties.map((property) => ({
        ...property,
        displayOptions: searchDisplay,
      })),
      {
        displayName: "Extraction",
        name: "extractionOptions",
        type: "collection",
        placeholder: "Add extraction option",
        default: {},
        displayOptions: searchDisplay,
        options: [
          {
            displayName: "Extract Top Results",
            name: "extract",
            type: "boolean",
            default: false,
            description: "Whether to enrich top search results with extracted page content",
          },
          {
            displayName: "Extract Mode",
            name: "extractMode",
            type: "options",
            default: "auto",
            options: EXTRACT_MODE_OPTIONS,
            description: "Extraction mode used when enriching search results",
          },
          {
            displayName: "Extract Top Count",
            name: "extractTop",
            type: "number",
            default: 3,
            typeOptions: {
              minValue: 1,
              maxValue: 5,
            },
            description: "Number of top results to extract when enrichment is enabled (1-5)",
          },
          {
            displayName: "Minimum Runes",
            name: "minRunes",
            type: "number",
            default: 0,
            typeOptions: {
              minValue: 0,
            },
            description: "Auto-mode escalation floor. Use 0 for the server default.",
          },
        ],
      },
      ...commonQueryProperties.map((property) => ({
        ...property,
        displayOptions: imageDisplay,
      })),
      {
        displayName: "URL",
        name: "url",
        type: "string",
        default: "",
        required: true,
        displayOptions: {
          show: {
            resource: ["extract"],
            operation: ["getContent"],
          },
        },
        placeholder: "https://openserp.org",
        description: "Absolute URL to fetch and extract",
      },
      {
        displayName: "URLs",
        name: "urls",
        type: "string",
        default: "",
        required: true,
        displayOptions: {
          show: {
            resource: ["extract"],
            operation: ["getContentBatch"],
          },
        },
        placeholder: "https://openserp.org\nhttps://openserp.org/docs",
        description:
          "Up to 20 absolute URLs, one per line. Duplicates are dropped. A URL that fails returns an item with an error instead of failing the batch.",
      },
      {
        displayName: "Extract Options",
        name: "extractOptions",
        type: "collection",
        placeholder: "Add option",
        default: {},
        displayOptions: {
          show: {
            resource: ["extract"],
            operation: ["getContent", "getContentBatch"],
          },
        },
        options: [
          {
            displayName: "Clean",
            name: "clean",
            type: "boolean",
            default: true,
            description: "Whether to prefer article-style cleaned content",
          },
          {
            displayName: "Language",
            name: "lang",
            type: "string",
            default: "",
            placeholder: "en",
            description: "Language hint for content extraction",
          },
          {
            displayName: "Minimum Runes",
            name: "minRunes",
            type: "number",
            default: 0,
            typeOptions: {
              minValue: 0,
            },
            description: "Auto-mode escalation floor. Use 0 for the server default.",
          },
          {
            displayName: "Mode",
            name: "mode",
            type: "options",
            default: "auto",
            options: EXTRACT_MODE_OPTIONS,
            description: "Extraction strategy",
          },
          {
            displayName: "Region",
            name: "region",
            type: "string",
            default: "",
            placeholder: "DE",
            description:
              "Two-letter country code to extract from, for geo-fenced or localized pages. On OpenSERP Cloud this adds 1 credit per extracted URL.",
          },
          {
            displayName: "Use llms.txt",
            name: "useLlmsTxt",
            type: "boolean",
            default: false,
            description:
              "Whether site-root URLs should prefer /llms-full.txt or /llms.txt when available",
          },
        ],
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const inputItems = this.getInputData();
    const outputItems: INodeExecutionData[] = [];

    for (let itemIndex = 0; itemIndex < inputItems.length; itemIndex++) {
      const credentials = await this.getCredentials("openSerpApi", itemIndex);
      const client = new OpenSERP(toClientConfig(credentials));
      const resource = this.getNodeParameter("resource", itemIndex) as Resource;

      try {
        if (resource === "search") {
          const operation = this.getNodeParameter("operation", itemIndex) as SearchOperation;
          const response =
            operation === "single"
              ? await client.search(buildSearchParams(this, itemIndex))
              : await client.megaSearch(buildMegaSearchParams(this, itemIndex));
          outputItems.push(...fanOutResults(response, client, itemIndex));
          continue;
        }

        if (resource === "image") {
          const operation = this.getNodeParameter("operation", itemIndex) as ImageOperation;
          const response =
            operation === "single"
              ? await client.image(buildImageParams(this, itemIndex))
              : await client.megaImage(buildMegaImageParams(this, itemIndex));
          outputItems.push(...fanOutResults(response, client, itemIndex));
          continue;
        }

        if (resource === "extract") {
          const operation = this.getNodeParameter("operation", itemIndex) as ExtractOperation;
          if (operation === "getContentBatch") {
            // One output item per URL - downstream nodes then treat each page
            // like any other item, including the ones that carry an error.
            const response = await client.batchExtract(buildBatchExtractParams(this, itemIndex));
            outputItems.push(...fanOutResults(response, client, itemIndex));
            continue;
          }
          const response = await client.extract(buildExtractParams(this, itemIndex));
          outputItems.push(singleItem(response, client, itemIndex));
          continue;
        }

        if (resource === "account") {
          const operation = this.getNodeParameter("operation", itemIndex) as AccountOperation;
          const response = operation === "getMe" ? await client.me() : await client.pricing();
          outputItems.push(singleItem(response, client, itemIndex));
          continue;
        }

        const operation = this.getNodeParameter("operation", itemIndex) as EnginesOperation;
        const response =
          operation === "capabilities"
            ? await client.enginesCapabilities()
            : await client.enginesStatus();
        outputItems.push(singleItem(response, client, itemIndex));
      } catch (error) {
        if (this.continueOnFail()) {
          outputItems.push({
            json: {
              error: formatError(error),
              ...errorDetails(error),
            },
            pairedItem: {
              item: itemIndex,
            },
          });
          continue;
        }

        throw new NodeOperationError(this.getNode(), toOperationError(error), { itemIndex });
      }
    }

    return [outputItems];
  }
}

function toClientConfig(credentials: ICredentialDataDecryptedObject): OpenSERPConfig {
	const apiKey = stringValue(credentials.apiKey);
	const baseUrl = stringValue(credentials.baseUrl);
	const timeoutMs = numberValue(credentials.timeoutMs);

	return compactObject({
		apiKey,
		baseUrl,
		timeoutMs: timeoutMs ?? 30000,
	});
}

function buildSearchParams(context: IExecuteFunctions, itemIndex: number): SearchParams {
	return compactObject({
		...baseQueryParams(context, itemIndex),
		engine: context.getNodeParameter('engine', itemIndex) as Engine,
		...searchExtractionParams(context, itemIndex),
		format: 'json',
	}) as SearchParams;
}

function buildMegaSearchParams(context: IExecuteFunctions, itemIndex: number): MegaSearchParams {
	return compactObject({
		...baseQueryParams(context, itemIndex),
		engines: enginesParam(context, itemIndex),
		mode: context.getNodeParameter('mode', itemIndex) as MegaMode,
		...searchExtractionParams(context, itemIndex),
		format: 'json',
	}) as MegaSearchParams;
}

function buildImageParams(context: IExecuteFunctions, itemIndex: number): ImageParams {
	return compactObject({
		...baseQueryParams(context, itemIndex),
		engine: context.getNodeParameter('engine', itemIndex) as Engine,
		format: 'json',
	}) as ImageParams;
}

function buildMegaImageParams(context: IExecuteFunctions, itemIndex: number): MegaImageParams {
	return compactObject({
		...baseQueryParams(context, itemIndex),
		engines: enginesParam(context, itemIndex),
		mode: context.getNodeParameter('mode', itemIndex) as MegaMode,
		format: 'json',
	}) as MegaImageParams;
}

function buildExtractParams(context: IExecuteFunctions, itemIndex: number): ExtractParams {
	const options = context.getNodeParameter('extractOptions', itemIndex, {}) as IDataObject;

	return compactObject({
		url: context.getNodeParameter('url', itemIndex) as string,
		mode: options.mode as ExtractMode | undefined,
		lang: stringValue(options.lang),
		minRunes: numberValue(options.minRunes),
		clean: options.clean as boolean | undefined,
		useLlmsTxt: options.useLlmsTxt as boolean | undefined,
		region: stringValue(options.region),
		format: 'json',
	}) as ExtractParams;
}

function buildBatchExtractParams(
	context: IExecuteFunctions,
	itemIndex: number,
): BatchExtractParams {
	const options = context.getNodeParameter('extractOptions', itemIndex, {}) as IDataObject;

	return compactObject({
		urls: splitUrlList(context.getNodeParameter('urls', itemIndex) as string),
		mode: options.mode as ExtractMode | undefined,
		lang: stringValue(options.lang),
		minRunes: numberValue(options.minRunes),
		clean: options.clean as boolean | undefined,
		useLlmsTxt: options.useLlmsTxt as boolean | undefined,
		region: stringValue(options.region),
	}) as BatchExtractParams;
}

function splitUrlList(raw: string): string[] {
	return String(raw ?? '')
		.split(/\r?\n/)
		.map((url) => url.trim())
		.filter(Boolean);
}

function baseQueryParams(context: IExecuteFunctions, itemIndex: number): Partial<SearchParams> {
	const options = context.getNodeParameter('additionalOptions', itemIndex, {}) as IDataObject;

	return compactObject({
		text: context.getNodeParameter('text', itemIndex) as string,
		limit: numberValue(context.getNodeParameter('limit', itemIndex)),
		region: stringValue(context.getNodeParameter('region', itemIndex)),
		lang: stringValue(context.getNodeParameter('lang', itemIndex)),
		date: stringValue(options.date),
		file: stringValue(options.file),
		site: stringValue(options.site),
		start: numberValue(options.start),
		filter: options.filter as boolean | undefined,
		features: options.features as boolean | undefined,
	}) as Partial<SearchParams>;
}

function searchExtractionParams(context: IExecuteFunctions, itemIndex: number): Partial<SearchParams> {
	const options = context.getNodeParameter('extractionOptions', itemIndex, {}) as IDataObject;
	const enabled = options.extract === true;

	// Unified extract knob: extract=N enriches the top N results (1-5). The toggle
	// plus the Extract Top Count field collapse into a single numeric depth.
	const top = numberValue(options.extractTop);
	const depth = enabled ? Math.min(5, Math.max(1, top ?? 1)) : undefined;

	return compactObject({
		extract: depth,
		extractMode: enabled ? (options.extractMode as ExtractMode | undefined) : undefined,
		minRunes: enabled ? numberValue(options.minRunes) : undefined,
	}) as Partial<SearchParams>;
}

function enginesParam(context: IExecuteFunctions, itemIndex: number): Engine[] | undefined {
	const engines = context.getNodeParameter('engines', itemIndex, []) as Engine[];
	return engines.length > 0 ? engines : undefined;
}

function fanOutResults(
	response: unknown,
	client: OpenSERP,
	itemIndex: number,
): INodeExecutionData[] {
	if (typeof response === 'string') {
		return [singleItem({ value: response }, client, itemIndex)];
	}

	const envelope = asDataObject(response);
	const results = Array.isArray(envelope.results) ? envelope.results : [];
	const telemetry = telemetryMeta(envelope, client);

	if (results.length === 0) {
		return [
			{
				json: {
					results: [],
					openserp_meta: telemetry,
				},
				pairedItem: {
					item: itemIndex,
				},
			},
		];
	}

	return results.map((result, index) => {
		const json = asDataObject(result);
		if (index === 0) {
			json.openserp_meta = telemetry;
		}

		return {
			json,
			pairedItem: {
				item: itemIndex,
			},
		};
	});
}

function singleItem(response: unknown, client: OpenSERP, itemIndex: number): INodeExecutionData {
	const json = asDataObject(response);
	json.openserp_meta = telemetryMeta(json, client);

	return {
		json,
		pairedItem: {
			item: itemIndex,
		},
	};
}

function telemetryMeta(envelope: IDataObject, client: OpenSERP): IDataObject {
	return compactObject({
		response_meta: envelope.meta as IDataObject | undefined,
		pagination: envelope.pagination as IDataObject | undefined,
		status: client.lastResponse?.status,
		request_id: client.lastResponse?.requestId,
		credits: client.lastResponse?.credits as IDataObject | undefined,
		engine_used: client.lastResponse?.engineUsed,
		network_bytes: client.lastResponse?.networkBytes,
	}) as IDataObject;
}

function asDataObject(value: unknown): IDataObject {
	if (isDataObject(value)) {
		return { ...value };
	}

	return {
		value: value as IDataObject[string],
	};
}

function isDataObject(value: unknown): value is IDataObject {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function compactObject<T extends Record<string, unknown>>(value: T): T {
	return Object.fromEntries(
		Object.entries(value).filter(([, entry]) => {
			if (entry === undefined || entry === null) {
				return false;
			}

			if (typeof entry === 'string' && entry.trim() === '') {
				return false;
			}

			if (Array.isArray(entry) && entry.length === 0) {
				return false;
			}

			return true;
		}),
	) as T;
}

function stringValue(value: unknown): string | undefined {
	if (typeof value !== 'string') {
		return undefined;
	}

	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : undefined;
}

function numberValue(value: unknown): number | undefined {
	if (typeof value === 'number' && Number.isFinite(value)) {
		return value;
	}

	if (typeof value === 'string' && value.trim() !== '') {
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : undefined;
	}

	return undefined;
}

function formatError(error: unknown): string {
	const message = error instanceof Error ? error.message : String(error);
	if (message.includes('github.com/openserpapi/n8n') || message.includes('openserp.org/docs')) {
		return message;
	}
	return `${message}${message.endsWith('.') ? '' : '.'} ${SUPPORT_HINT}`;
}

function toOperationError(error: unknown): Error {
	if (!(error instanceof Error)) {
		return new Error(formatError(error));
	}

	error.message = formatError(error);
	return error;
}

function errorDetails(error: unknown): IDataObject {
  if (!(error instanceof SERPError)) return {};
  return compactObject({
    status: error.status,
    code: error.code,
    request_id: error.requestId,
    retry_after: error.retryAfter,
  }) as IDataObject;
}
