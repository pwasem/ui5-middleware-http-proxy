const ui5Logger = require('@ui5/logger')
const dotenv = require('dotenv')
const request = require('request')

// load .env
dotenv.config()

// get logger instance
const log = ui5Logger.getLogger('ui5-middleware-http-proxy')

/**
 * Resolve an entry pattern of env:key
 * @private
 * @param {string} entry - .env entry to be resolved
 * @returns {string} the resolved key from process.env
 */
const _resolveDotenv = entry => {
  const key = entry.split(':')[1]
  return process.env[key]
}

/**
 * Resolve http basic auth credentials
 * @private
 * @param {object} auth - the auth object to be resolved
 * @param {string} [auth.user] - the user
 * @param {string} [auth.pass] - the pass
 * @returns {object} the resolved auth object containing user and pass
 */
const _resolveAuth = auth => {
  if (Object.entries(auth).length === 0) {
    return null
  }
  const { user = '', pass = '' } = auth
  const resolvedUser = user.startsWith('env:') ? _resolveDotenv(user) : user
  const resolvedPass = pass.startsWith('env:') ? _resolveDotenv(pass) : pass
  return {
    user: resolvedUser,
    pass: resolvedPass
  }
}

/**
 * Resolve the uri for a given path and request incl. any query
 * @private
 * @param {object} options - the options
 * @param {string} options.path - the path to be resolved
 * @param {object} options.req - the req incl. any query
 * @returns {string} the resolved uri
 */
const _resolveUri = ({ path, req }) => {
  // resolve path
  let resolvedUri = `${path}${req.path}`
  const query = req.url.split('?')[1]
  // append query, if any
  if (query) {
    resolvedUri += '?' + query
  }
  return resolvedUri
}

/**
 * Custom UI5 Server middleware for proxying requests
 *
 * @param {object} parameters Parameters
 * @param {object} parameters.resources Resource collections
 * @param {module:@ui5/fs.AbstractReader} parameters.resources.all Reader or Collection to read resources of the
 *                                        root project and its dependencies
 * @param {module:@ui5/fs.AbstractReader} parameters.resources.rootProject Reader or Collection to read resources of
 *                                        the project the server is started in
 * @param {module:@ui5/fs.AbstractReader} parameters.resources.dependencies Reader or Collection to read resources of
 *                                        the projects dependencies
 * @param {object} parameters.middlewareUtil Specification version dependent interface to a
 *                                        [MiddlewareUtil]{@link module:@ui5/server.middleware.MiddlewareUtil} instance
 * @param {object} parameters.options Options
 * @param {string} [parameters.options.configuration] Custom server middleware configuration if given in ui5.yaml
 * @returns {function} Middleware function to use
 */
module.exports = ({ options: { configuration = {} } }) => {
  const { debug = false, baseUrl, path = '/', secure = true, auth = {} } = configuration

  // baseUrl is mandatory
  if (!baseUrl) {
    throw new Error('configuration.baseUrl is mandatory')
  }

  // debug log
  if (debug) {
    log.info(`Registering proxy for ${baseUrl}${path}`)
  }

  // get http basic auth, if any
  const resolvedAuth = _resolveAuth(auth)

  // cookie jar for subsequent requests
  const jar = request.jar()

  // middleware
  return (req, res, next) => {
    // resolve the uri
    const resolvedUri = _resolveUri({ path, req })

    // debug log for each request
    if (debug) {
      log.info(`${req.method} ${req.url} -> ${baseUrl}${resolvedUri}`)
    }

    // options for proxy request
    const options = {
      baseUrl,
      uri: resolvedUri,
      auth: resolvedAuth,
      strictSSL: secure,
      jar
    }

    // pipe proxy request
    req
      .pipe(
        request(options)
          .on('error', err => {
            log.error(err.message)
            next(err)
          })
      )
      .pipe(res)
  }
}
