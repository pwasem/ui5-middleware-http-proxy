const proxy = require('express-http-proxy')
const log = require('@ui5/logger').getLogger('server:customMiddleware:http-proxy')

const _getAuthorizationHeader = ({ user, pass }) => {
  if (!user || !pass) {
    throw new Error('configuration.auth.user and configuration.auth.pass are required for custom middleware http proxy')
  }
  const base64 = Buffer
    .from(`${user}:${pass}`)
    .toString('base64')
  return `Basic ${base64}`
}

const _getHeaders = ({ auth }) => {
  const headers = {}
  if (auth) {
    headers.Authorization = _getAuthorizationHeader(auth)
  }
  return headers
}

/**
 * Custom UI5 Server middleware for proxying requests
 *
 * @param {Object} parameters Parameters
 * @param {Object} parameters.resources Resource collections
 * @param {module:@ui5/fs.AbstractReader} parameters.resources.all Reader or Collection to read resources of the
 *                                        root project and its dependencies
 * @param {module:@ui5/fs.AbstractReader} parameters.resources.rootProject Reader or Collection to read resources of
 *                                        the project the server is started in
 * @param {module:@ui5/fs.AbstractReader} parameters.resources.dependencies Reader or Collection to read resources of
 *                                        the projects dependencies
 * @param {Object} parameters.options Options
 * @param {string} [parameters.options.configuration] Custom server middleware configuration if given in ui5.yaml
 * @returns {function} Middleware function to use
 */
module.exports = ({ options }) => {
  const { debug = false, host, path = '/', secure = true, auth = null } = options.configuration || {}

  if (!host) {
    throw new Error('configuration.host is required for custom middleware http proxy')
  }

  if (debug) {
    log.info(`Registering proxy for ${host}${path}`)
  }

  // get & cache headers for subsequent requests
  const headers = _getHeaders({ auth })

  return proxy(host, {
    proxyReqPathResolver: req => {
      // resolve paths
      let resolvedPath = `${path}${req.path}`
      const query = req.url.split('?')[1]
      // append query
      if (query) {
        resolvedPath += '?' + query
      }
      return resolvedPath
    },

    proxyReqOptDecorator: (proxyReqOpts, originalReq) => {
      // ignore self-signed certificates?
      proxyReqOpts.rejectUnauthorized = secure
      // set headers
      Object.assign(proxyReqOpts.headers, headers)
      return proxyReqOpts
    },

    proxyErrorHandler: (err, res, next) => {
      log.error(`${res.req.method} ${host}${path}${res.req.path}`)
      next(err)
    }

  })
}
