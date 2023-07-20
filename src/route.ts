import {
  OpenAPIRouteSchema,
  OpenAPISchema,
  RouteOptions,
  RouteValidated,
} from './types'
import {
  Body,
  extractParameter,
  extractQueryParameters,
} from './deprecated/parameters'
import { z, ZodType } from 'zod'
import { isAnyZodType } from './zod/utils'
import { RouteConfig } from '@asteasolutions/zod-to-openapi'
import { ResponseConfig } from '@asteasolutions/zod-to-openapi/dist/openapi-registry'

export class OpenAPIRoute implements OpenAPIRouteSchema {
  static isRoute = true

  static schema: OpenAPISchema
  params: RouteOptions

  constructor(params: RouteOptions) {
    this.params = params
  }

  static getSchema(): OpenAPISchema {
    return this.schema
  }

  get schema(): OpenAPISchema {
    // @ts-ignore
    return this.__proto__.constructor.schema
  }

  getSchema(): OpenAPISchema {
    // @ts-ignore
    return this.__proto__.constructor.getSchema()
  }

  static getSchemaZod(): RouteConfig {
    const schema = this.getSchema()

    let parameters: any = null
    let requestBody: object = schema.requestBody as object
    const responses: any = {}

    if (!isAnyZodType(requestBody)) {
      requestBody = z.object({
        ...requestBody,
      })
    }

    requestBody = {
      content: {
        'application/json': {
          schema: requestBody,
        },
      },
    }

    if (schema.responses) {
      for (const [key, value] of Object.entries(schema.responses)) {
        let responseSchema: object = (value.schema as object) || {}

        if (!isAnyZodType(responseSchema)) {
          responseSchema = z.object({
            ...responseSchema,
          })
        }

        const contentType = value.contentType || 'application/json'

        // @ts-ignore
        responses[key] = {
          description: value.description,
          content: {
            [contentType]: {
              schema: responseSchema,
            },
          },
        }
      }
    }

    if (schema.parameters) {
      let values = schema.parameters
      const _params: any = {}

      // Convert parameter array into object
      if (Array.isArray(values)) {
        values = values.reduce(
          // @ts-ignore
          (obj, item) => Object.assign(obj, { [item.params.name]: item }),
          {}
        )
      }

      for (const [key, value] of Object.entries(values as Record<any, any>)) {
        const location = value.location === 'path' ? 'params' : value.location

        if (!_params[location]) {
          _params[location] = {}
        }

        // console.log(value)
        _params[location][key] = value.getValue()
      }

      for (const [key, value] of Object.entries(_params)) {
        _params[key] = z.object(value as any)
      }

      parameters = _params
    }

    delete schema.requestBody
    delete schema.parameters
    delete schema.responses

    // console.log(requestBody.shape)
    // console.log(parameters.shape)

    // Deep copy
    //@ts-ignore
    return {
      ...schema,
      request: {
        body: requestBody,
        ...parameters,
      },
      responses: responses,
    }
  }

  static getSchemaNormalized(): Record<any, any> {
    const schema = this.getSchema()
    let requestBody = schema.requestBody

    if (!(requestBody instanceof ZodType)) {
      // @ts-ignore
      requestBody = z.object(requestBody)
    }

    const responses: Record<string, any> = {}
    if (schema.responses) {
      for (const [key, value] of Object.entries(schema.responses)) {
        let schema = value.schema

        if (!(schema instanceof ZodType)) {
          // @ts-ignore
          schema = z.object(schema)
        }

        responses[key] = schema
      }
    }

    let parameters: any = null
    if (schema.parameters) {
      let values = schema.parameters
      const _params: any = {}

      // Convert parameter array into object
      if (Array.isArray(values)) {
        values = values.reduce(
          // @ts-ignore
          (obj, item) => Object.assign(obj, { [item.params.name]: item }),
          {}
        )
      }

      for (const [key, value] of Object.entries(values as Record<any, any>)) {
        if (!_params[value.location]) {
          _params[value.location] = {}
        }

        _params[value.location][key] = value.getValue()
      }

      parameters = z.object(_params)
    }

    // Deep copy
    return {
      ...schema,
      responses: responses,
      ...(parameters ? { parameters: parameters } : {}),
      ...(requestBody ? { requestBody: requestBody } : {}),
    }
  }

  static getSchemaOpenAPI(): Record<any, any> {
    const schema = this.getSchema()
    let requestBody = schema.requestBody

    if (!(requestBody instanceof ZodType)) {
      // @ts-ignore
      requestBody = z.object(requestBody)
    }

    const responses: Record<string, any> = {}
    if (schema.responses) {
      for (const [key, value] of Object.entries(schema.responses)) {
        let schema = value.schema

        if (!(schema instanceof ZodType)) {
          // @ts-ignore
          schema = z.object(schema)
        }

        responses[key] = schema
      }
    }

    let parameters: any = null
    if (schema.parameters) {
      let values = schema.parameters
      const _params: any = {}

      // Convert parameter array into object
      if (Array.isArray(values)) {
        values = values.reduce(
          // @ts-ignore
          (obj, item) => Object.assign(obj, { [item.params.name]: item }),
          {}
        )
      }

      for (const [key, value] of Object.entries(values as Record<any, any>)) {
        if (!_params[value.location]) {
          _params[value.location] = {}
        }

        _params[value.location][key] = value.getValue()
      }

      parameters = z.object(_params)
    }

    // Deep copy
    return {
      ...schema,
      responses: responses,
      ...(parameters ? { parameters: parameters } : {}),
      ...(requestBody ? { requestBody: requestBody } : {}),
    }
  }

  handleValidationError(errors: Record<string, any>): Response {
    return Response.json(
      {
        errors: errors,
        success: false,
        result: {},
      },
      {
        status: 400,
      }
    )
  }

  async execute(...args: any[]) {
    const { data, errors } = await this.validateRequest(args[0])

    if (Object.keys(errors).length > 0) {
      return this.handleValidationError(errors)
    }

    args.push(data)

    const resp = await this.handle(...args)

    if (!(resp instanceof Response) && typeof resp === 'object') {
      return Response.json(resp)
    }

    return resp
  }

  async validateRequest(request: Request): Promise<RouteValidated> {
    const params = this.getSchema().parameters || {}
    const requestBody = this.getSchema().requestBody
    const queryParams = extractQueryParameters(request)
    const endpointParams: any = {}
    const endpointRawData: any = {}
    if (this.getSchema().parameters) {
      let values = this.getSchema().parameters
      const _params: any = {}

      if (Array.isArray(values)) {
        values = values.reduce(
          // @ts-ignore
          (obj, item) => Object.assign(obj, { [item.params.name]: item }),
          {}
        )
      }

      for (const [key, value] of Object.entries(values as Record<any, any>)) {
        if (!_params[value.location]) {
          _params[value.location] = {}
          endpointRawData[value.location] = {}
        }

        _params[value.location][key] = value.getValue()

        endpointRawData[value.location][key] = extractParameter(
          request,
          queryParams,
          key,
          value.location
        )
      }

      for (const [key, value] of Object.entries(_params)) {
        endpointParams[key] = z.object(value as any)
      }
    }

    if (
      request.method.toLowerCase() !== 'get' &&
      requestBody &&
      (requestBody.contentType === undefined ||
        requestBody.contentType === 'application/json')
    ) {
      // @ts-ignore
      endpointParams['body'] = new Body(requestBody).type.getValue()

      let json

      // eslint-disable-next-line no-useless-catch
      try {
        json = await request.json()
      } catch (e) {
        throw e
        // TODO
        // validationErrors['body'] = (e as ApiException).message
      }

      endpointRawData['body'] = json
    }

    let validationSchema: any = z.object(endpointParams)

    if (
      this.params?.raiseUnknownParameters === undefined ||
      this.params?.raiseUnknownParameters === true
    ) {
      validationSchema = validationSchema.strict()
    }

    // console.log(validationSchema.shape)
    const validationResult = validationSchema.safeParse(endpointRawData)
    // console.log(validationResult.error.issues)

    return {
      data: validationResult.data,
      errors: validationResult.error.flatten(),
    }
  }

  handle(...args: any[]): Promise<Response | Record<string, any>> {
    throw new Error('Method not implemented.')
  }
}
