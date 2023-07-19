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
  getFormatedParameters,
  Resp,
} from './deprecated/parameters'
import { z, ZodType } from 'zod'

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

  static getParsedSchema(): Record<any, any> {
    const schema = this.getSchema()

    let requestBody = null
    if (schema.requestBody) {
      requestBody = new Body(schema.requestBody, {
        contentType: schema.requestBody.contentType,
      }).getValue()
    }

    const responses: Record<string, any> = {}
    if (schema.responses) {
      for (const [key, value] of Object.entries(schema.responses)) {
        const resp = new Resp(value.schema, value)
        responses[key] = resp.getValue()
      }
    }

    // Deep copy
    return {
      ...schema,
      parameters: schema.parameters
        ? getFormatedParameters(schema.parameters)
        : [],
      responses: responses,
      ...(requestBody ? { requestBody: requestBody } : {}),
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
      console.log(new Body(requestBody))
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

    console.log(validationSchema.shape)
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
