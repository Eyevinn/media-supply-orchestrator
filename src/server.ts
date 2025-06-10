import api from './api';
import orchestrator from './orchestrator';

const server = api({ title: 'media-supply-orchestrator' });

const PORT = process.env.PORT ? Number(process.env.PORT) : 8000;

const INPUT_BUCKET = process.env.INPUT_BUCKET || 'input';
const ABRSUBS_BUCKET = process.env.ABRSUBS_BUCKET || 'abrsubs';
const OUTPUT_BUCKET = process.env.OUTPUT_BUCKET || 'origin';

if (!INPUT_BUCKET || !ABRSUBS_BUCKET || !OUTPUT_BUCKET) {
  throw new Error(
    'Please set INPUT_BUCKET, ABRSUBS_BUCKET, and OUTPUT_BUCKET environment variables'
  );
}

if (!process.env.S3_ENDPOINT_URL) {
  throw new Error('Please set S3_ENDPOINT_URL environment variable');
}

if (!process.env.S3_ACCESS_KEY_ID) {
  throw new Error('Please set S3_ACCESS_KEY_ID environment variable');
}

if (!process.env.S3_SECRET_ACCESS_KEY) {
  throw new Error('Please set S3_SECRET_ACCESS_KEY environment variable');
}

if (!process.env.ENCORE_URL) {
  throw new Error('Please set ENCORE_URL environment variable');
}

if (!process.env.PUBLIC_BASE_URL) {
  throw new Error('Please set PUBLIC_BASE_URL environment variable');
}

orchestrator({
  publicBaseUrl: process.env.PUBLIC_BASE_URL,
  inputBucket: INPUT_BUCKET,
  abrsubsBucket: ABRSUBS_BUCKET,
  encoreUrl: process.env.ENCORE_URL,
  s3EndpointUrl: process.env.S3_ENDPOINT_URL,
  s3AccessKeyId: process.env.S3_ACCESS_KEY_ID,
  s3SecretAccessKey: process.env.S3_SECRET_ACCESS_KEY
});

server.listen({ port: PORT, host: '0.0.0.0' }, (err, address) => {
  if (err) {
    throw err;
  }
  console.log(`Server listening on ${address}`);
});

export default server;
