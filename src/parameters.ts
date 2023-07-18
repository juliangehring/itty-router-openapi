import { ValidationError } from './exceptions'
import {
  EnumerationParameterType,
  ParameterBody,
  ParameterLocation,
  ParameterType,
  RegexParameterType,
  ResponseSchema,
  StringParameterType,
} from './types'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'

export class BaseParameter {
  public static isParameter = true
  public isParameter = true
  type = 'string'
  public params: ParameterType
  public generated: boolean

  constructor(params?: ParameterType) {
    this.params = params || {}
    this.generated = true

    if (this.params.required === undefined) this.params.required = true
  }

  getValue() {
    const value: Record<string, any> = {
      type: this.type,
      description: this.params.description,
      example: this.params.example,
      default: this.params.default,
    }

    if (this.params.deprecated) value.deprecated = this.params.deprecated

    return value
  }
}

export class Arr extends BaseParameter {
  private innerType

  constructor(innerType: any, params?: ParameterType) {
    super(params)
    this.innerType = innerType
  }

  getValue() {
    return convertParams(this.innerType.getValue().array(), this.params)
  }
}

export class Obj extends BaseParameter {
  public isObj = true

  private fields: Record<string, BaseParameter>

  constructor(fields: Record<string, BaseParameter>, params?: ParameterType) {
    super(params) // TODO: fix obj params
    this.fields = fields
  }

  getValue() {
    const values: any = {}

    for (const [key, value] of Object.entries(this.fields)) {
      if (value.getValue) {
        values[key] = value.getValue()
      } else {
        values[key] = value
      }
    }

    return z.object(values)
  }
}

// @ts-ignore
function convertParams(field, params) {
  if (params.required === false)
    // @ts-ignore
    field = field.optional()

  if (params.description) field = field.describe(params.description)

  if (params.default)
    // @ts-ignore
    field = field.default(params.default)

  return field
}

export class Num extends BaseParameter {
  getValue() {
    return convertParams(z.coerce.number(), this.params)
  }
}

export class Int extends Num {
  getValue() {
    return convertParams(z.coerce.number().int(), this.params)
  }
}

export class Str extends BaseParameter {
  getValue() {
    return convertParams(z.coerce.string(), this.params)
  }
}

export class DateTime extends Str {
  getValue() {
    return convertParams(z.coerce.string().datetime(), this.params)
  }
}

export class Regex extends Str {
  public declare params: RegexParameterType

  constructor(params: RegexParameterType) {
    super(params)
  }

  getValue() {
    // @ts-ignore
    return convertParams(
      z.coerce.string().regex(this.params.pattern),
      this.params
    )
  }
}

export class Email extends Regex {
  getValue() {
    return convertParams(z.coerce.string().email(), this.params)
  }
}

export class Uuid extends Regex {
  getValue() {
    return convertParams(z.coerce.string().uuid(), this.params)
  }
}

export class Hostname extends Regex {
  getValue() {
    return convertParams(
      z.coerce
        .string()
        .regex(
          /^(([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9\\-]*[a-zA-Z0-9])\\.)*([A-Za-z0-9]|[A-Za-z0-9][A-Za-z0-9\\-]*[A-Za-z0-9])$/
        ),
      this.params
    )
  }
}

export class Ipv4 extends Regex {
  getValue() {
    return convertParams(z.coerce.string().ip(), this.params)
  }
}

export class Ipv6 extends Regex {
  getValue() {
    return convertParams(z.coerce.string().ip({ version: 'v6' }), this.params)
  }
}

export class DateOnly extends Str {
  getValue() {
    return convertParams(
      z.preprocess((val) => String(val).substring(0, 10), z.coerce.date()),
      this.params
    )
  }
}

export class Bool extends Str {
  getValue() {
    return convertParams(z.coerce.boolean(), this.params)
  }
}

export class Enumeration extends Str {
  public declare params: EnumerationParameterType
  public values: Record<string, any>

  constructor(params: EnumerationParameterType) {
    super(params)

    let { values } = params
    if (Array.isArray(values))
      values = Object.fromEntries(values.map((x) => [x, x]))

    if (this.params.enumCaseSensitive === false) {
      values = Object.keys(values).reduce((accumulator, key) => {
        // @ts-ignore
        accumulator[key.toLowerCase()] = values[key]
        return accumulator
      }, {})
    }

    this.values = values
  }

  getValue() {
    let field
    if (this.params.enumCaseSensitive) {
      field = z.nativeEnum(this.values)
    } else {
      field = z.preprocess(
        (val) => String(val).toLowerCase(),
        z.nativeEnum(this.values)
      )
    }

    return convertParams(field, this.params)
  }
}

export class Parameter {
  public location: string
  private rawType: any
  public type: BaseParameter
  public params: ParameterLocation

  constructor(location: string, rawType: any, params: ParameterLocation) {
    this.location = location
    this.rawType = rawType

    if (params.required === undefined) params.required = true
    this.params = params

    this.type = this.getType(rawType, params)
  }

  getType(type: any, params: ParameterLocation): any {
    if (type instanceof z.ZodType) {
      return type
    }
    // console.log(123)
    // console.log(type)
    // console.log(type instanceof z.ZodType)
    // console.log(type)
    if (type.generated === true) {
      return type
    }

    if (type.isParameter === true) {
      // @ts-ignore
      return new type({ ...params })
    }

    if (type === String) {
      return new Str({ ...params })
    }

    if (typeof type === 'string') {
      return new Str({ example: type })
    }

    if (type === Number) {
      return new Num({ ...params })
    }

    if (typeof type === 'number') {
      return new Num({ example: type })
    }

    if (type === Boolean) {
      return new Bool({ ...params })
    }

    if (typeof type === 'boolean') {
      return new Bool({ example: type })
    }

    if (type === Date) {
      return new DateTime()
    }

    if (Array.isArray(type)) {
      if (type.length === 0) {
        throw new Error('Arr must have a type')
      }

      return new Arr(this.getType(type[0], params), { ...params })
    }

    if (typeof type === 'object') {
      const parsed: Record<string, any> = {}
      for (const [key, value] of Object.entries(type)) {
        parsed[key] = this.getType(value, {})
      }

      return new Obj(parsed, params)
    }

    // console.log(123)
    throw new Error(`${type} not implemented`)
  }

  getValue(): Record<string, any> {
    // @ts-ignore
    const schema = zodToJsonSchema(this.type.getValue(), {
      target: 'openApi3',
    })

    return {
      description: this.params.description,
      required: this.params.required,
      schema: schema,
      name: this.params.name,
      in: this.location,
    }
  }

  validate(value: any): any {
    const result = this.type.getValue().safeParse(value)
    if (result.success) {
      value = result.data
    } else {
      throw new ValidationError(result.error.issues)
    }

    return value
  }
}

export class Body extends Parameter {
  paramsBody: ParameterBody

  constructor(rawType: any, params?: ParameterBody) {
    // @ts-ignore
    super(null, rawType, {})
    // @ts-ignore
    this.paramsBody = params
  }

  getValue(): Record<string, any> {
    // @ts-ignore
    const schema = zodToJsonSchema(this.type.getValue(), {
      target: 'openApi3',
    })

    const param: Record<string, any> = {
      description: this.paramsBody?.description,
      content: {},
    }

    param.content[this.paramsBody?.contentType || 'application/json'] = {
      schema: schema,
    }

    return param
  }
}

export class Resp extends Parameter {
  constructor(rawType: any, params: ResponseSchema) {
    // @ts-ignore
    super(null, rawType, params)
  }

  // @ts-ignore
  getValue() {
    const value = super.getValue()
    const contentType = this.params?.contentType
      ? this.params?.contentType
      : 'application/json'

    const param: Record<string, any> = {
      description: this.params.description || 'Successful Response',
      content: {},
    }

    param.content[contentType] = { schema: value.schema }
    return param
  }
}

export function Query(type: any, params: ParameterLocation = {}): Parameter {
  return new Parameter('query', type, params)
}

export function Path(type: any, params: ParameterLocation = {}): Parameter {
  return new Parameter('path', type, params)
}

export function Header(type: any, params: ParameterLocation = {}): Parameter {
  return new Parameter('header', type, params)
}

export function Cookie(type: any, params: ParameterLocation = {}): Parameter {
  return new Parameter('cookie', type, params)
}

export function extractParameter(
  request: Request,
  query: Record<string, any>,
  name: string,
  location: string
): any {
  if (location === 'query') {
    return query[name]
  }
  if (location === 'path') {
    // @ts-ignore
    return request.params[name]
  }
  if (location === 'header') {
    // @ts-ignore
    return request.headers.get(name)
  }
  if (location === 'cookie') {
    throw new Error('Cookie parameters not implemented yet')
  }
}

export function extractQueryParameters(request: Request): Record<string, any> {
  const url = decodeURIComponent(request.url).split('?')

  if (url.length === 1) {
    return {}
  }

  const query = url.slice(1).join('?')

  const params: Record<string, any> = {}
  for (const param of query.split('&')) {
    const paramSplitted = param.split('=')
    const key = paramSplitted[0]
    const value = paramSplitted[1]

    if (params[key] === undefined) {
      params[key] = value
    } else if (!Array.isArray(params[key])) {
      params[key] = [params[key], value]
    } else {
      params[key].push(value)
    }
  }

  return params
}

export function Required(param: Parameter): Parameter {
  param.params.required = true

  return param
}

export function getFormatedParameters(
  params: Record<string, Parameter> | Parameter[]
) {
  const formated = []
  const isArray = Array.isArray(params)

  for (const [key, parameter] of Object.entries(params || {})) {
    if (isArray && !parameter.params.name) {
      throw new Error('Parameter must have a defined name when using as Array')
    }

    const name = parameter.params.name ? parameter.params.name : key

    formated.push({
      // TODO: check this type before assign
      // @ts-ignore
      ...parameter.getValue(),
      name: name,
    })
  }

  return formated
}
