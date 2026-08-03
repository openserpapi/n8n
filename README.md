# @openserp/n8n-nodes-openserp

[![npm version](https://img.shields.io/npm/v/@openserp/n8n-nodes-openserp.svg)](https://www.npmjs.com/package/@openserp/n8n-nodes-openserp)
[![license](https://img.shields.io/npm/l/@openserp/n8n-nodes-openserp.svg)](https://github.com/openserpapi/n8n/blob/main/LICENSE.md)

n8n community node for OpenSERP. It supports web search, image search, single and batch URL extraction, OpenSERP Cloud account/pricing calls, and Cloud engine capability/status calls.

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

The credential test calls `/v1/me` when an API key is present and `/health` when no API key is present.

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
