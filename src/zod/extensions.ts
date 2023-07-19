import type { ZodTypeAny, z } from 'zod'
import { isZodType } from './utils'

declare module 'zod' {
  interface ZodTypeDef {
    example?: any
  }

  interface ZodType<
    Output = any,
    Def extends ZodTypeDef = ZodTypeDef,
    Input = Output
  > {
    example<T extends ZodTypeAny>(this: T, example: any): T
  }
}

function preserveMetadataFromModifier(
  zod: typeof z,
  modifier: keyof typeof z.ZodType.prototype
) {
  const zodModifier = zod.ZodType.prototype[modifier]
  ;(zod.ZodType.prototype[modifier] as any) = function (
    this: any,
    ...args: any[]
  ) {
    const result = zodModifier.apply(this, args)
    result._def.example = this._def.example

    return result
  }
}

export function extendZodWithExample(zod: typeof z) {
  if (typeof zod.ZodType.prototype.example !== 'undefined') {
    // This zod instance is already extended with the required methods,
    // doing it again will just result in multiple wrapper methods for
    // `optional` and `nullable`
    return
  }

  zod.ZodType.prototype.example = function (example: any) {
    const result = new (this as any).constructor({
      ...this._def,
      example: example,
    })

    if (isZodType(this, 'ZodObject')) {
      const originalExtend = this.extend

      result.extend = function (...args: any) {
        const extendedResult = originalExtend.apply(this, args)

        extendedResult._def.example = {
          example: this._def.example,
        }

        return extendedResult
      }
    }

    return result
  }

  // preserveMetadataFromModifier(zod, 'optional')
  // preserveMetadataFromModifier(zod, 'nullable')
  // preserveMetadataFromModifier(zod, 'default')
  //
  // preserveMetadataFromModifier(zod, 'transform')
  // preserveMetadataFromModifier(zod, 'refine')

  const zodDeepPartial = zod.ZodObject.prototype.deepPartial
  zod.ZodObject.prototype.deepPartial = function (this: any) {
    const initialShape = this._def.shape()

    const result = zodDeepPartial.apply(this)

    const resultShape = result._def.shape()

    Object.entries(resultShape).forEach(([key, value]) => {
      value._def.example = initialShape[key]?._def?.example
    })

    return result
  }

  const zodPick = zod.ZodObject.prototype.pick as any
  zod.ZodObject.prototype.pick = function (this: any, ...args: any[]) {
    const result = zodPick.apply(this, args)
    result._def.example = undefined

    return result
  }

  const zodOmit = zod.ZodObject.prototype.omit as any
  zod.ZodObject.prototype.omit = function (this: any, ...args: any[]) {
    const result = zodOmit.apply(this, args)
    result._def.example = undefined

    return result
  }
}
