import { PrismaClient } from '@prisma/client'

const db = new PrismaClient({
  //log only if debug mode
  log:
    process.env.NODE_ENV === 'development'
      ? ['query', 'info', 'warn', 'error']
      : [],
})

export { db }