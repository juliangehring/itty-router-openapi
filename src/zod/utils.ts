import type { z } from 'zod'
import { Arr, Bool, DateTime, Num, Obj, Str } from '../deprecated/parameters'

export function isAnyZodType(schema: object): schema is z.ZodType {
  return schema._def !== undefined
}

export function legacyTypeIntoZod(type: any): any {
  if (isAnyZodType(type)) {
    return type
  }

  if (type === String) {
    return new Str()
  }

  if (typeof type === 'string') {
    return new Str({ example: type })
  }

  if (type === Number) {
    return new Num()
  }

  if (typeof type === 'number') {
    return new Num({ example: type })
  }

  if (type === Boolean) {
    return new Bool()
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

    return new Arr(type)
  }

  if (typeof type === 'object') {
    return new Obj(type)
  }

  throw new Error(`${type} not implemented`)
}
