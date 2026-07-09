import type { ICredentialTestRequest, ICredentialType, INodeProperties } from "n8n-workflow";

export class OpenSerpApi implements ICredentialType {
  name = "openSerpApi";

  displayName = "OpenSERP API";

  documentationUrl = "https://openserp.org/docs/integrations/n8n";

  properties: INodeProperties[] = [
    {
      displayName: "API Key",
      name: "apiKey",
      type: "string",
      typeOptions: {
        password: true,
      },
      default: "",
      description:
        "Optional OpenSERP Cloud API key. Get a key at https://openserp.org/dashboard/keys. Leave empty to call a self-hosted OpenSERP server.",
    },
    {
      displayName: "Base URL",
      name: "baseUrl",
      type: "string",
      default: "",
      placeholder: "https://api.openserp.org/v1 or http://localhost:7000",
      description:
        "Optional API base URL. Leave empty to use OpenSERP Cloud with an API key, or localhost OSS without one. Source and issues: https://github.com/openserpapi/n8n/issues.",
    },
    {
      displayName: "Timeout (Ms)",
      name: "timeoutMs",
      type: "number",
      default: 30000,
      typeOptions: {
        minValue: 1000,
      },
      description: "Request timeout in milliseconds",
    },
  ];

  test: ICredentialTestRequest = {
    request: {
      method: "GET",
      baseURL:
        '={{$credentials.apiKey ? (($credentials.baseUrl || "https://api.openserp.org").replace(/\\/v1\\/?$/, "").replace(/\\/$/, "")) : (($credentials.baseUrl || "http://localhost:7000").replace(/\\/$/, ""))}}',
      url: '={{$credentials.apiKey ? "/v1/me" : "/health"}}',
      headers: {
        Authorization: '={{$credentials.apiKey ? "Bearer " + $credentials.apiKey : ""}}',
      },
    },
  };
}
