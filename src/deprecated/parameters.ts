import { ValidationError } from '../exceptions'
import {
  EnumerationParameterType,
  ParameterBody,
  ParameterLocation,
  ParameterType,
  RegexParameterType,
  ResponseSchema,
} from '../types'
import { z } from 'zod'
import { legacyTypeIntoZod } from '../zod/utils'

// @ts-ignore
function convertParams(field, params) {
  params = params || {}
  // console.log(z.coerce.date().isOptional())
  // if (params.required === false)
  // @ts-ignore
  // field = field.optional()

  if (params.description) field = field.describe(params.description)

  if (params.default)
    // @ts-ignore
    field = field.default(params.default)

  return field
}

export class Arr {
  static generator = true
  constructor(innerType: any, params?: ParameterType) {
    return convertParams(legacyTypeIntoZod(innerType[0]).array(), params)
  }
}

export class Obj {
  static generator = true
  constructor(fields: object, params?: ParameterType) {
    const parsed: Record<string, any> = {}
    for (const [key, value] of Object.entries(fields)) {
      parsed[key] = legacyTypeIntoZod(value)
    }
    // console.log(parsed)

    return z.object(parsed)
  }
}

export class Num {
  static generator = true
  constructor(params?: ParameterType) {
    return convertParams(z.coerce.number(), params)
  }
}

export class Int {
  static generator = true
  constructor(params?: ParameterType) {
    return convertParams(z.coerce.number().int(), params)
  }
}

export class Str {
  static generator = true
  constructor(params?: ParameterType) {
    return convertParams(z.string(), params)
  }
}

export class DateTime {
  static generator = true
  constructor(params?: ParameterType) {
    return convertParams(z.string().datetime(), params)
  }
}

export class Regex {
  static generator = true
  constructor(params: RegexParameterType) {
    return convertParams(
      // @ts-ignore
      z.string().regex(params.pattern),
      params
    )
  }
}

export class Email {
  static generator = true
  constructor(params?: ParameterType) {
    return convertParams(z.string().email(), params)
  }
}

export class Uuid {
  static generator = true
  constructor(params?: ParameterType) {
    return convertParams(z.string().uuid(), params)
  }
}

export class Hostname {
  static generator = true
  constructor(params?: ParameterType) {
    return convertParams(
      z
        .string()
        .regex(
          /^(([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9\\-]*[a-zA-Z0-9])\\.)*([A-Za-z0-9]|[A-Za-z0-9][A-Za-z0-9\\-]*[A-Za-z0-9])$/
        ),
      params
    )
  }
}

export class Ipv4 {
  static generator = true
  constructor(params?: ParameterType) {
    return convertParams(z.coerce.string().ip(), params)
  }
}

export class Ipv6 {
  static generator = true
  constructor(params?: ParameterType) {
    return convertParams(z.string().ip({ version: 'v6' }), params)
  }
}

export class DateOnly {
  static generator = true
  constructor(params?: ParameterType) {
    return convertParams(z.coerce.date(), params)
  }
}

export class Bool {
  static generator = true
  constructor(params?: ParameterType) {
    return convertParams(z.boolean(), params)
  }
}

export class Enumeration {
  static generator = true
  constructor(params: EnumerationParameterType) {
    let { values } = params
    if (Array.isArray(values))
      values = Object.fromEntries(values.map((x) => [x, x]))

    if (params.enumCaseSensitive === false) {
      values = Object.keys(values).reduce((accumulator, key) => {
        // @ts-ignore
        accumulator[key.toLowerCase()] = values[key]
        return accumulator
      }, {})

      let field
      if (params.enumCaseSensitive) {
        field = z.nativeEnum(values)
      } else {
        field = z.preprocess(
          (val) => String(val).toLowerCase(),
          z.nativeEnum(values)
        )
      }

      return convertParams(field, params)
    }
  }
}

export function Query(type: any, params: ParameterLocation = {}) {
  return {
    name: params.name,
    location: 'query',
    type: legacyTypeIntoZod(type, params),
  }
}

export function Path(type: any, params: ParameterLocation = {}) {
  return {
    name: params.name,
    location: 'params',
    type: legacyTypeIntoZod(type, params),
  }
}

export function Header(type: any, params: ParameterLocation = {}) {
  return {
    name: params.name,
    location: 'header',
    type: legacyTypeIntoZod(type, params),
  }
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

export function extractQueryParameters(
  request: Request
): Record<string, any> | null {
  const url = decodeURIComponent(request.url).split('?')

  if (url.length === 1) {
    return null
  }

  const query = url.slice(1).join('?')

  const params: Record<string, any> = {}
  for (const param of query.split('&')) {
    const paramSplit = param.split('=')
    const key = paramSplit[0]
    const value = paramSplit[1]

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

export function genParametersForUnknownEndpoint(params: Record<any, any>) {
  const formated = []
  const isArray = Array.isArray(params)

  for (const [key, parameter] of Object.entries(params || {})) {
    if (isArray && !parameter.name) {
      throw new Error('Parameter must have a defined name when using as Array')
    }

    const name = parameter.name || key

    formated.push({
      // TODO: check this type before assign
      // @ts-ignore
      ...parameter.getValue(),
      name: name,
    })
  }

  return formated
}
