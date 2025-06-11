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
    poller.stop();
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
