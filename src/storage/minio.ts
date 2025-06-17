import * as Minio from 'minio';

export async function setupListener(
  bucketName: string,
  endpoint: URL,
  accessKeyId: string,
  secretAccessKey: string,
  onNotification: (r: any) => Promise<void>
) {
  const client = new Minio.Client({
    endPoint: endpoint.hostname,
    accessKey: accessKeyId,
    secretKey: secretAccessKey,
    useSSL: endpoint.protocol === 'https:'
  });
  const poller = client.listenBucketNotification(bucketName, '', '.mp4', [
    's3:ObjectCreated:*'
  ]);
  if (!poller) {
    console.error('Failed to setup listener for bucket notifications');
  }
  console.log('Listening for notifications');
  poller.on('notification', async (record) => {
    await onNotification(record);
  });
}

export async function removeFile(
  bucketName: string,
  filePath: string,
  endpoint: URL,
  accessKeyId: string,
  secretAccessKey: string
): Promise<void> {
  const client = new Minio.Client({
    endPoint: endpoint.hostname,
    accessKey: accessKeyId,
    secretKey: secretAccessKey,
    useSSL: endpoint.protocol === 'https:'
  });
  try {
    await client.removeObject(bucketName, filePath);
    console.log(`File removed successfully: ${filePath}`);
  } catch (error) {
    console.error(`Failed to remove file ${filePath}:`, error);
    throw error;
  }
}

export async function removeDir(
  bucketName: string,
  dirPath: string,
  endpoint: URL,
  accessKeyId: string,
  secretAccessKey: string
): Promise<void> {
  const client = new Minio.Client({
    endPoint: endpoint.hostname,
    accessKey: accessKeyId,
    secretKey: secretAccessKey,
    useSSL: endpoint.protocol === 'https:'
  });

  try {
    const objects = await client.listObjects(bucketName, dirPath, true);
    for await (const obj of objects) {
      await client.removeObject(bucketName, obj.name);
      console.log(`Removed file: ${obj.name}`);
    }
    console.log(`Directory removed successfully: ${dirPath}`);
  } catch (error) {
    console.error(`Failed to remove directory ${dirPath}:`, error);
    throw error;
  }
}

export async function readTextFile(
  url: string,
  endpoint: URL,
  accessKeyId: string,
  secretAccessKey: string
): Promise<string> {
  const client = new Minio.Client({
    endPoint: endpoint.hostname,
    accessKey: accessKeyId,
    secretKey: secretAccessKey,
    useSSL: endpoint.protocol === 'https:'
  });
  const bucketName = new URL(url).hostname;
  const filePath = new URL(url).pathname.slice(1); // Remove leading slash

  const stream = await client.getObject(bucketName, filePath);
  const chunks: Buffer[] = [];

  return new Promise((resolve, reject) => {
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    stream.on('error', reject);
  });
}

export async function fileExists(
  url: string,
  endpoint: URL,
  accessKeyId: string,
  secretAccessKey: string
): Promise<boolean> {
  const client = new Minio.Client({
    endPoint: endpoint.hostname,
    accessKey: accessKeyId,
    secretKey: secretAccessKey,
    useSSL: endpoint.protocol === 'https:'
  });

  try {
    const bucketName = new URL(url).hostname;
    const filePath = new URL(url).pathname.slice(1); // Remove leading slash
    await client.statObject(bucketName, filePath);
    return true;
  } catch (error) {
    return false;
  }
}
