const log = require('@ui5/logger').getLogger('ui5-middleware-http-proxy')
const request = require('request')
const dotenv = require('dotenv')
const lodash = require('lodash')

// load .env
dotenv.config()

const envOptionRegEx = /^\${env\.(.*)}$/

/**
 * Parses the configuration option. If a ${env.<PARAM>} pattern is detected,
 * the corresponding .env-file value will be retrieved. Otherwise the
 * original value will be returned
 *
 * @param {String} optionValue the entered config option
 * @return {string|*}
 */
const _parseConfigOption = (optionValue) => {
  if (optionValue === undefined || optionValue === null) {
    return undefined
  }
  if (envOptionRegEx.test(optionValue)) {
    const envVariable = optionValue.match(envOptionRegEx)[1]
    return process.env[envVariable]
  } else {
    return optionValue
  }
}

/**
 * Returns the specified option value. If the ${env.<variable-name>} syntax
 * is recognized, the value will be read from the .env file. If no option value
 * was passed the global .env file variable specified by envVariableName will be used,
 * otherwise the specifyed default value will be used
 *
 * @param {String|undefined} optionValue option value from yaml or nothing
 * @param {String} envVariableName variable name from .env file
 * @param {Any} defaultValue default value if none could be detected
 * @param {Boolean} isBoolean specifies if the config option value is a boolean
 * @returns {String|Boolean|undefined}
 */
const _getConfigOption = (
  optionValue,
  envVariableName,
  defaultValue = '',
  isBoolean = false
) => {
  let parsedOptionValue = optionValue
    ? _parseConfigOption(optionValue)
    : process.env[envVariableName]
  if (parsedOptionValue === undefined || parsedOptionValue === null) {
    parsedOptionValue = defaultValue
  }
  return isBoolean ? parsedOptionValue === 'true' : parsedOptionValue
}

const _getAuth = ({ auth = {} }) => {
  const user = _getConfigOption(auth.user, 'HTTP_PROXY_AUTH_USER')
  const pass = _getConfigOption(auth.pass, 'HTTP_PROXY_AUTH_PASS')

  if (user && pass) {
    auth = {
      user,
      pass
    }
  }

  return !lodash.isEmpty(auth) ? auth : null
}

const _resolvePath = ({ path, req }) => {
  // resolve paths
  let resolvedPath = `${path}${req.path}`
  const query = req.url.split('?')[1]
  // append query
  if (query) {
    resolvedPath += '?' + query
  }
  return resolvedPath
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
module.exports = ({ options: { configuration = {} } }) => {
  const { debug = false, path = '/' } = configuration

  // get http basic auth if any
  const auth = _getAuth(configuration)

  // retrieve additional config options
  const baseUrl = _getConfigOption(
    configuration.baseUrl,
    'HTTP_PROXY_BASE_URL'
  )
  const secure = _getConfigOption(
    configuration.secure,
    'HTTP_PROXY_IS_SECURE',
    true,
    true
  )

  // baseUrl is mandatory
  if (!baseUrl) {
    throw new Error('configuration.baseUrl is mandatory')
  }

  // debug log
  if (debug) {
    log.info(`Registering proxy for ${baseUrl}${path}`)
  }

  // cookie jar for subsequent requests
  const jar = request.jar()

  // middleware
  return (req, res, next) => {
    const resolvedPath = _resolvePath({ path, req })

    // debug log for each request
    if (debug) {
      log.info(`${req.method} ${req.url} -> ${baseUrl}${resolvedPath}`)
    }

    // options for proxy request
    const options = {
      baseUrl,
      uri: resolvedPath,
      auth,
      strictSSL: secure,
      jar
    }

    // pipe proxy request
    req
      .pipe(
        request(options).on('error', (err) => {
          log.error(err.message)
          next(err)
        })
      )
      .pipe(res)
  }
}
