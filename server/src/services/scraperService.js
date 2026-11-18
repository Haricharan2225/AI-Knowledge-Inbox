/**
 * @file scraperService.js
 * @description Enterprise-grade web scraper using Cheerio.
 * Features safe URL validation (SSRF protection against private IPs/localhost),
 * timeout management via AbortController, noise elimination (scripts, ads, navigation),
 * and clean title/text extraction.
 */

const dns = require('dns').promises;
const net = require('net');
const cheerio = require('cheerio');
const logger = require('../config/logger');

/**
 * Checks if an IP address belongs to a private, loopback, or reserved subnet.
 * @param {string} ip
 * @returns {boolean} True if the IP is private or restricted.
 */
function isPrivateOrReservedIP(ip) {
  // Check IPv4
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map((p) => parseInt(p, 10));

    // 0.0.0.0/8 (Current network)
    if (parts[0] === 0) return true;
    // 10.0.0.0/8 (Private network)
    if (parts[0] === 10) return true;
    // 127.0.0.0/8 (Loopback)
    if (parts[0] === 127) return true;
    // 169.254.0.0/16 (Link-local / AWS / Cloud metadata)
    if (parts[0] === 169 && parts[1] === 254) return true;
    // 172.16.0.0/12 (Private network: 172.16.x.x - 172.31.x.x)
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    // 192.168.0.0/16 (Private network)
    if (parts[0] === 192 && parts[1] === 168) return true;
    // 224.0.0.0/4 (Multicast)
    if (parts[0] >= 224 && parts[0] <= 239) return true;
    // 240.0.0.0/4 (Reserved)
    if (parts[0] >= 240) return true;

    return false;
  }

  // Check IPv6
  if (net.isIPv6(ip)) {
    const normalized = ip.toLowerCase();
    // Loopback
    if (normalized === '::1' || normalized === '0000:0000:0000:0000:0000:0000:0000:0001') return true;
    // Unspecified
    if (normalized === '::' || normalized === '0000:0000:0000:0000:0000:0000:0000:0000') return true;
    // Unique Local Address (fc00::/7)
    if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
    // Link-Local (fe80::/10)
    if (normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb')) return true;

    return false;
  }

  return true;
}

/**
 * Validates a URL for format and SSRF vulnerabilities.
 * @param {string} rawUrl
 * @returns {Promise<URL>} Parsed URL object if safe.
 * @throws {Error} If URL is invalid, non-HTTP, or points to internal infrastructure.
 */
async function validateSafeUrl(rawUrl) {
  let parsedUrl;
  try {
    parsedUrl = new URL(rawUrl);
  } catch (err) {
    const error = new Error(`Invalid URL format: "${rawUrl}"`);
    error.statusCode = 400;
    throw error;
  }

  // Enforce HTTP / HTTPS protocols only
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    const error = new Error(`Unsupported protocol: ${parsedUrl.protocol}. Only http and https are allowed.`);
    error.statusCode = 400;
    throw error;
  }

  const hostname = parsedUrl.hostname.toLowerCase();

  // Block localhost aliases and internal domain suffixes
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.lan')
  ) {
    const error = new Error(`Access to local or internal hostname is forbidden for security: ${hostname}`);
    error.statusCode = 403;
    throw error;
  }

  // If hostname is directly an IP address
  if (net.isIP(hostname)) {
    if (isPrivateOrReservedIP(hostname)) {
      const error = new Error(`Access to private/internal IP address is forbidden for security: ${hostname}`);
      error.statusCode = 403;
      throw error;
    }
  } else {
    // Resolve DNS to verify the target IP address is not pointing to private subnets (SSRF protection)
    try {
      const lookupResult = await dns.lookup(hostname);
      if (isPrivateOrReservedIP(lookupResult.address)) {
        const error = new Error(`Hostname "${hostname}" resolves to private IP (${lookupResult.address}), request blocked for security.`);
        error.statusCode = 403;
        throw error;
      }
    } catch (dnsErr) {
      if (dnsErr.statusCode) throw dnsErr;
      const error = new Error(`Unable to resolve hostname "${hostname}": ${dnsErr.code || dnsErr.message}`);
      error.statusCode = 422;
      throw error;
    }
  }

  return parsedUrl;
}

/**
 * Scrapes clean title and textual content from a validated public web URL.
 * @param {string} targetUrl
 * @param {object} options
 * @param {number} options.timeoutMs - Request timeout in milliseconds (default: 10000)
 * @returns {Promise<{ url: string, title: string, content: string, contentLength: number, scrapedAt: string }>}
 */
async function scrapeUrl(targetUrl, options = {}) {
  const timeoutMs = options.timeoutMs || 10000;
  const validatedUrl = await validateSafeUrl(targetUrl);
  const normalizedUrl = validatedUrl.toString();

  logger.info(`🌐 Fetching webpage for ingestion: ${normalizedUrl}`, { timeoutMs });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    response = await fetch(normalizedUrl, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 (TuriumAI-KnowledgeBot/1.0)',
        'Accept': 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
  } catch (fetchErr) {
    clearTimeout(timeoutId);
    if (fetchErr.name === 'AbortError') {
      const error = new Error(`Webpage request timed out after ${timeoutMs}ms: ${normalizedUrl}`);
      error.statusCode = 504;
      throw error;
    }
    const error = new Error(`Failed to reach URL (${normalizedUrl}): ${fetchErr.message}`);
    error.statusCode = 502;
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const error = new Error(`Failed to fetch URL. Server responded with HTTP ${response.status} (${response.statusText})`);
    error.statusCode = response.status >= 500 ? 502 : response.status;
    throw error;
  }

  const contentType = (response.headers.get('content-type') || '').toLowerCase();
  if (!contentType.includes('text/html') && !contentType.includes('text/plain') && !contentType.includes('application/xhtml+xml')) {
    const error = new Error(`Unsupported content-type "${contentType}". Only HTML or text web pages can be ingested.`);
    error.statusCode = 415;
    throw error;
  }

  const rawHtml = await response.text();
  if (!rawHtml || !rawHtml.trim()) {
    const error = new Error('Webpage returned empty content.');
    error.statusCode = 422;
    throw error;
  }

  // Load into Cheerio for DOM sanitization
  const $ = cheerio.load(rawHtml);

  // 1. Extract Title
  let extractedTitle = (
    $('meta[property="og:title"]').attr('content') ||
    $('meta[name="twitter:title"]').attr('content') ||
    $('title').first().text() ||
    $('h1').first().text() ||
    validatedUrl.hostname
  ).trim();

  // Normalize single line title
  extractedTitle = extractedTitle.replace(/\s+/g, ' ');

  // 2. Remove non-content elements, boilerplate, and scripts
  $(
    'script, style, noscript, nav, footer, header, aside, iframe, svg, ' +
    'canvas, form, button, input, select, textarea, [role="navigation"], ' +
    '[role="banner"], [role="contentinfo"], .ad, .advertisement, #cookie-banner, #nav, #footer'
  ).remove();

  // 3. Target main content container if available, otherwise body
  let mainContentSelection = $('article, main, [role="main"]');
  if (mainContentSelection.length === 0) {
    mainContentSelection = $('body');
  }

  // 4. Extract and clean text
  let rawText = mainContentSelection.text();

  // Clean excessive whitespace, carriage returns, and tabs while preserving paragraph separations
  const cleanContent = rawText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\t/g, ' ')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join('\n\n');

  if (!cleanContent || cleanContent.length < 20) {
    const error = new Error('Extracted webpage content is too short or lacks readable text.');
    error.statusCode = 422;
    throw error;
  }

  logger.info(`✅ Successfully scraped "${extractedTitle}" (${cleanContent.length} chars) from ${normalizedUrl}`);

  return {
    url: normalizedUrl,
    title: extractedTitle,
    content: cleanContent,
    contentLength: cleanContent.length,
    scrapedAt: new Date().toISOString(),
  };
}

module.exports = {
  validateSafeUrl,
  isPrivateOrReservedIP,
  scrapeUrl,
};
