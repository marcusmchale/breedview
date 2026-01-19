
import { getIntrospectionQuery, buildClientSchema, printSchema } from 'graphql';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables manually from .env.development
const envPath = path.join(__dirname, '../.env.development');
const envContent = fs.readFileSync(envPath, 'utf-8');
envContent.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const [key, ...valueParts] = trimmed.split('=');
    const value = valueParts.join('=').replace(/^['"]|['"]$/g, '');
    if (key) process.env[key] = value;
  }
});

// Handle command line arguments
const args = process.argv.slice(2);
const apiHost = args.find(arg => arg.startsWith('--api-host='))?.split('=')[1];
const graphqlPath = args.find(arg => arg.startsWith('--graphql-path='))?.split('=')[1];
const outputFile = args.find(arg => arg.startsWith('--output='))?.split('=')[1];

const API_HOST = apiHost || process.env.VITE_API_HOST;
const GRAPHQL_PATH = graphqlPath || process.env.VITE_GRAPHQL_PATH;
const GRAPHQL_URI = `${API_HOST}${GRAPHQL_PATH}`;
const OUTPUT_PATH = outputFile || './src/graphql/schema.graphql';
const CSRF_ENDPOINT = `${API_HOST}/csrf`;

// Cookie storage for maintaining session
const cookieJar = {};

function parseCookies(response) {
  const setCookieHeader = response.headers.get('set-cookie');
  if (setCookieHeader) {
    const cookies = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
    cookies.forEach(cookie => {
      const [nameValue] = cookie.split(';');
      const [name, value] = nameValue.split('=');
      if (name && value) {
        cookieJar[name.trim()] = value.trim();
      }
    });
  }
}

function getCookieHeader() {
  return Object.entries(cookieJar)
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
}

async function fetchWithRetry(url, options, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      // Add cookies to all requests
      const cookieHeader = getCookieHeader();
      if (cookieHeader) {
        options.headers = {
          ...options.headers,
          'Cookie': cookieHeader
        };
      }

      const response = await fetch(url, options);

      // Store any new cookies from the response
      parseCookies(response);

      return response;
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      console.log(`Retry ${i + 1}/${maxRetries} after error:`, error.message);
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
}

async function fetchCsrfToken() {
  console.log('Fetching CSRF token...');

  const response = await fetchWithRetry(CSRF_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch CSRF token: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  console.log('✅ CSRF token obtained');
  console.log('   Cookies stored:', Object.keys(cookieJar));
  return data.token;
}

async function fetchSchema(csrfToken) {
  console.log('Fetching GraphQL schema...');

  const response = await fetchWithRetry(GRAPHQL_URI, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken
    },
    body: JSON.stringify({
      query: getIntrospectionQuery()
    })
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();

  if (result.errors) {
    throw new Error(`GraphQL errors: ${result.errors.map(e => e.message).join(', ')}`);
  }

  console.log('✅ Schema data received');
  return result.data;
}

async function main() {
  try {
    // Validate required parameters
    if (!API_HOST || !GRAPHQL_PATH) {
      console.error('❌ Missing required parameters:');
      console.error('   VITE_API_HOST or --api-host=<url>');
      console.error('   VITE_GRAPHQL_PATH or --graphql-path=<path>');
      console.error('');
      console.error('Usage: node scripts/fetchGraphqlSchema.js [options]');
      console.error('Options:');
      console.error('  --api-host=<url>      API host URL');
      console.error('  --graphql-path=<path> GraphQL endpoint path');
      console.error('  --output=<path>       Output file path');
      process.exit(1);
    }

    console.log(`🚀 Starting schema fetch...`);
    console.log(`   API Host: ${API_HOST}`);
    console.log(`   GraphQL Path: ${GRAPHQL_PATH}`);
    console.log(`   GraphQL endpoint: ${GRAPHQL_URI}`);
    console.log(`   CSRF endpoint: ${CSRF_ENDPOINT}`);
    console.log(`   Output file: ${OUTPUT_PATH}`);
    console.log('');

    // Get CSRF token
    const csrfToken = await fetchCsrfToken();

    // Fetch schema using the same session
    const schemaData = await fetchSchema(csrfToken);

    // Build and format schema
    console.log('Building schema SDL...');
    const clientSchema = buildClientSchema(schemaData);
    const sdl = printSchema(clientSchema);

    // Write to file
    fs.writeFileSync(OUTPUT_PATH, sdl);

    console.log('');
    console.log(`✅ Schema successfully written to ${OUTPUT_PATH}`);
    console.log(`📊 Schema size: ${sdl.length} characters`);
    console.log(`🕒 Updated at: ${new Date().toLocaleString()}`);

  } catch (error) {
    console.error('❌ Error fetching schema:', error.message);
    console.log('Debug info:');
    console.log('   Stored cookies:', Object.keys(cookieJar));
    process.exit(1);
  }
}

// Handle fetch polyfill for Node.js environments that don't have it
if (typeof fetch === 'undefined') {
  global.fetch = require('node-fetch');
}

main();