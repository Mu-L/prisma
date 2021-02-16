import Debug from '@prisma/debug'
import { Platform } from '@prisma/get-platform'
import findCacheDir from 'find-cache-dir'
import fs from 'fs'
import makeDir from 'make-dir'
import os from 'os'
import path from 'path'
const debug = Debug('prisma:cache-dir')

export async function getRootCacheDir(): Promise<string | null> {
  if (os.platform() === 'win32') {
    const cacheDir = findCacheDir({ name: 'prisma', create: true })
    if (cacheDir) {
      return cacheDir
    }
    if (process.env.APPDATA) {
      return path.join(process.env.APPDATA, 'Prisma')
    }
  }
  // if this is lambda, nope
  if (process.env.AWS_LAMBDA_FUNCTION_VERSION) {
    try {
      await makeDir(`/tmp/prisma-download`)
      return `/tmp/prisma-download`
    } catch (e) {
      return null
    }
  }
  return path.join(os.homedir(), '.cache/prisma')
}

export async function getCacheDir(
  channel: string,
  version: string,
  platform: string,
): Promise<string | null> {
  const rootCacheDir = await getRootCacheDir()
  if (!rootCacheDir) {
    return null
  }
  const cacheDir = path.join(rootCacheDir, channel, version, platform)
  try {
    if (!fs.existsSync(cacheDir)) {
      await makeDir(cacheDir)
    }
  } catch (e) {
    debug('The following error is being caught and just there for debugging:')
    debug(e)
    return null
  }
  return cacheDir
}

export function getDownloadUrl(
  channel: string,
  version: string,
  platform: Platform,
  binaryName: string,
  extension = '.gz',
): string {
  const baseUrl =
    process.env.PRISMA_BINARIES_MIRROR || 'https://binaries.prisma.sh'
  const finalExtension =
    platform === 'windows' && NAPI_QUERY_ENGINE_BASE !== binaryName
      ? `.exe${extension}`
      : extension
  if (binaryName === NAPI_QUERY_ENGINE_BASE) {
    binaryName = getNapiName(platform, 'url')
    // Hard Code for Now
    channel = 'master'
    version = '28e77d62415dc0475af4c133d8b87d49caaa8f88'
  }

  return `${baseUrl}/${channel}/${version}/${platform}/${binaryName}${finalExtension}`
}
export const NAPI_QUERY_ENGINE_BASE = 'libquery_engine_napi'

export function getNapiName(platform: Platform, type: 'url' | 'fs') {
  const isUrl = type === 'url'
  if (platform.includes('windows')) {
    return isUrl
      ? `query_engine_napi.dll.node`
      : `query_engine_napi-${platform}.dll.node`
  } else if (
    platform.includes('linux') ||
    platform.includes('debian') ||
    platform.includes('rhel')
  ) {
    return isUrl
      ? `${NAPI_QUERY_ENGINE_BASE}.so.node`
      : `${NAPI_QUERY_ENGINE_BASE}-${platform}.so.node`
  } else if (platform.includes('darwin')) {
    return isUrl
      ? `${NAPI_QUERY_ENGINE_BASE}.dylib.node`
      : `${NAPI_QUERY_ENGINE_BASE}-${platform}.dylib.node`
  } else {
    throw new Error(
      `NAPI is currently not supported on your platform: ${platform}`,
    )
  }
}
