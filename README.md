[![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)

# ui5-middleware-http-proxy

Custom UI5 middleware extension for proxying http requests using [request](https://github.com/request/request)
with additional http basic authentication support.

Useful for proxying requests to a remote service from a local development enviroment or serving ui5 resources from a remote host.

Works well with [openui5-sdk-docker](https://github.com/pwasem/openui5-sdk-docker).

## Prerequisites

Make sure your project is using the latest [UI5 Tooling](https://sap.github.io/ui5-tooling/pages/GettingStarted/).

## Getting started

### Install

#### Add custom middleware

Add the custom middleware as a _devDependency_ to your project.

With `yarn`:

```shell
yarn add -D ui5-middleware-http-proxy
```

Or `npm`:

```shell
npm i -D ui5-middleware-http-proxy
```

Additionally the custom task needs to be manually defined as a _ui5 dependency_ in your project's `package.json`:

```json
{
  "ui5": {
    "dependencies": [
      "ui5-middleware-http-proxy"
    ]
  }
}
```

### Register

#### Register custom middleware

Register the custom middleware in your project's `ui5.yaml`:

```yaml
server:
  customMiddleware:
    # proxy for ui5 resources
    - name: ui5-middleware-http-proxy
      mountPath: /resources
      afterMiddleware: compression
      configuration:
        baseUrl: https://openui5.hana.ondemand.com
        path: /resources
    # proxy for ui5 test resources
    - name: ui5-middleware-http-proxy
      mountPath: /test-resources
      afterMiddleware: compression
      configuration:
        baseUrl: http://localhost:5000
        path: /test-resources
    # proxy for service with self signed certificate and http basic authentication
    - name: ui5-middleware-http-proxy
      mountPath: /service
      afterMiddleware: compression
      configuration:
        debug: true
        baseUrl: https://services.odata.org
        path: /V2/Northwind/Northwind.svc
        secure: false
        auth:
          user: kratos
          pass: atreus
```

### Additional configuration

#### Options

The custom middleware accepts the following configuration options:

|    name        |   type  |                Description                | mandatory | default |                        examples                       |
|:--------------:|:-------:|:-----------------------------------------:|:---------:|:-------:|:-----------------------------------------------------:|
|   `debug`      | boolean |         enable/disable debug logs         |     no    | `false` |                     `true`, `false`                   |
|   `baseUrl`    |  string |       baseUrl for proxying requests       |    yes    |    -    | `https://services.odata.org`, `http://localhost:5000` |
|    `path`      |  string |         path for proxying requests        |     no    |   `/`   |      `/resources`, `/V2/Northwind/Northwind.svc`      |
|   `secure`     | boolean |      reject self-signed certificates      |     no    |  `true` |                     `true`, `false`                   |
|    `auth`      |  object | credentials for http basic authentication |     no    |    -    |                                                       |
| `auth.user`    |  string |     user for http basic authentication    |     no    |    -    | `kratos`, `env:HTTP_PROXY_AUTH_USER`                  |
| `auth.pass`    |  string |   password for http basic authentication  |     no    |    -    | `atreus`, `env:HTTP_PROXY_AUTH_PASS`                  |

#### Support for .env files

Support for `.env` files is provided by the [dotenv](https://github.com/motdotla/dotenv) module.

Simply prefix your `.env` variables for with `env:` and provide them as `auth.user` and `auth.pass` in your `configuration`.

Instead of taking the plain string value, the variable will then be resolved against your `.env` file.

Example `configuration` file:

```yaml
server:
  customMiddleware:
    # proxy using .env credentials
    - name: ui5-middleware-http-proxy
      mountPath: /service
      afterMiddleware: compression
      configuration:
        debug: true
        baseUrl: https://services.odata.org
        path: /V2/Northwind/Northwind.svc
        secure: false
        auth:
          user: env:MY_HTTP_PROXY_AUTH_USER
          pass: env:MY_HTTP_PROXY_AUTH_PASS
```

Example `.env` file:

```shell
MY_HTTP_PROXY_AUTH_USER=kratos
MY_HTTP_PROXY_AUTH_PASS=atreus
```

##### NOTE:
This is a breaking API change as of version `^2.0.0`.

Version `^1.1.0` only supports static `.env` variables:

- `HTTP_PROXY_AUTH_USER`
- `HTTP_PROXY_AUTH_PASS`

## Example app

Please have look at [bookshop-ui](https://github.com/pwasem/bookshop-ui).
