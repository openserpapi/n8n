# @openserp/n8n-nodes-openserp

[![npm version](https://img.shields.io/npm/v/@openserp/n8n-nodes-openserp.svg)](https://www.npmjs.com/package/@openserp/n8n-nodes-openserp)
[![license](https://img.shields.io/npm/l/@openserp/n8n-nodes-openserp.svg)](https://github.com/openserpapi/n8n/blob/main/LICENSE.md)

n8n community node for OpenSERP. It supports web search, image search, single and batch URL extraction, OpenSERP Cloud account/pricing calls, Cloud engine capability/status calls, and use as a tool by n8n AI Agents.

## Install

In n8n, install the community package:

```text
@openserp/n8n-nodes-openserp
```

Install with npm:

```bash
npm install @openserp/n8n-nodes-openserp
```

## Credentials

Create an **OpenSERP API** credential.

OpenSERP Cloud:

```text
API Key: osk_live_...
Base URL: leave empty, or use https://api.openserp.org/v1
```

API keys are available at https://openserp.org/dashboard/keys.

Self-hosted OpenSERP:

```text
API Key: leave empty
Base URL: http://localhost:7000
```

For a server running on another machine, set **Base URL** to that server's root URL, for example `http://openserp-host:7000`. Do not append `/v1` to a self-hosted URL.

The credential test calls `/v1/me` when an API key is present and `/health` when no API key is present.

## Use with n8n AI Agents

OpenSERP uses n8n's native app-node tool wrapper. The normal OpenSERP node and the generated **OpenSERP Tool** are shipped in this same package; a second repository or npm package is not required.

1. Install or update to `@openserp/n8n-nodes-openserp@0.2.0` or later, then restart n8n.
2. Add an **AI Agent** and connect a chat model.
3. From the AI Agent's **Tool** connector, add **OpenSERP Tool**.
4. Select the OpenSERP credential, resource, operation, and any limits you want to keep under workflow-owner control.
5. For fields the model should choose, select n8n's **Let the model define this parameter** button.

Recommended AI-controlled fields:

- **Query** for web or image search.
- **Region**, **Language**, **Date Range**, **File Extension**, and **Site** when the user's request should determine filters.
- **URL** for single-page extraction.

Recommended workflow-controlled fields:

- **Resource** and **Operation**, which define the tool's purpose.
- **Limit**, **Engines**, **Mode**, extraction depth, and timeout, which affect cost, latency, and result size.
- Credentials and base URL.

For example, configure one OpenSERP Tool as `Search / Mega`, keep `Limit: 10`, `Mode: Balanced`, and `Extract Top Results: false`, then let the model fill **Query**, **Region**, and **Language**. A second tool can be configured as `Extract / Get Content` and let the model fill only **URL**.

n8n adds a generated tool description based on the selected resource and operation. You can switch it to a manual description when the agent needs stricter routing instructions, for example: `Search the public web for current factual information. Return source URLs with the result.`

On older self-hosted n8n releases that block community packages from being used as tools, set the following environment variable and restart n8n:

```text
N8N_COMMUNITY_PACKAGES_ALLOW_TOOL_USAGE=true
```

The `$fromAI()` function and the model-fill button only work while the node is connected to an AI Agent as a tool. Keep fixed limits for untrusted prompts so the model cannot create unexpectedly large searches or extraction requests.

## Operations

- **Search: Single** returns one n8n item per web result from one engine.
- **Search: Mega** returns one n8n item per merged web result across selected engines.
- **Image: Single** returns one n8n item per image result from one engine.
- **Image: Mega** returns one n8n item per merged image result across selected engines.
- **Extract: Get Content** returns extracted content for one URL.
- **Extract: Get Content (Many URLs)** returns one n8n item per URL for up to 20 URLs in a single request. A URL that fails becomes an item carrying an `error` instead of failing the whole batch.
- **Account: Get Me / Get Pricing** returns OpenSERP Cloud account and pricing metadata.
- **Engines: Get Capabilities / Get Status** returns OpenSERP Cloud engine metadata.

Search and image operations add `openserp_meta` to the first output item. This contains request telemetry such as status, request ID, credits, engine used, and response metadata.

## Cloud paging and errors

The Cloud credential sends `Authorization: Bearer` with your API key (`osk_live_xxx`). For web paging, keep **Limit** at 10, add **Start**, and use the previous response's `openserp_meta.pagination.next_start` while `has_more` is true. Google, Bing, and Yandex accept multiples of 10; Baidu supports early pages, Ecosia any offset, and DuckDuckGo only the first page. **Search / Mega / Balanced** rejects Start above 0; use **Single**, **Any**, or **Fast** for later pages.

**Date Range** is a publication-date range (`YYYYMMDD..YYYYMMDD`), supported by Cloud web search on Google and Ecosia. Unsupported paging/date filters return `400 invalid_request` without charge. Change the parameters before retrying.

**Engines / Get Status** returns operational status and latency. **Any** starts engines in your order, overlapping slow attempts; **Fast** prioritizes recent health and latency. Use `openserp_meta.engine_used` for the winner; `engines_tried` and `engines_skipped` may be absent.

When **Continue On Fail** is enabled, failed items include `status`, `code`, `request_id`, and `retry_after` when available. Honor the delay when scheduling retries; `503 engine_unavailable` carries 60 seconds. The node does not retry automatically.

## Good Workflow Fits

- Feed fresh Google or Bing results into an AI workflow.
- Monitor a keyword set and send rank changes to Slack or Sheets.
- Extract readable page content before summarizing it.
- Check Cloud usage before a scheduled batch job runs.

## Examples

Web search:

```text
Resource: Search
Operation: Single
Engine: Google
Query: openserp
Limit: 10
```

Multi-engine image search:

```text
Resource: Image
Operation: Mega
Engines: Google, Bing, DuckDuckGo
Mode: Balanced
Query: openserp logo
```

Extract a URL:

```text
Resource: Extract
Operation: Get Content
URL: https://openserp.org
Mode: Auto
```

Extract several URLs in one request:

```text
Resource: Extract
Operation: Get Content (Many URLs)
URLs: https://openserp.org
      https://openserp.org/docs
Mode: Auto
```

Read a geo-fenced page as a local visitor by setting the **Region** extract option to a two-letter country code such as `DE`. On OpenSERP Cloud this adds 1 credit per extracted URL.

## Resources

- [OpenSERP Cloud](https://openserp.org)
- [Self-hosted OpenSERP server](https://github.com/karust/openserp)
- [Source and issues](https://github.com/openserpapi/n8n)
