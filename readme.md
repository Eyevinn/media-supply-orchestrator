[![Slack](https://slack.osaas.io/badge.svg)](https://slack.osaas.io)

# Eyevinn Open Media Supply Orchestrator

> _Part of Eyevinn Open Media Supply Chain Solution_

![Solution Overview](./open_media_supply.png)

A solution for content preparation for Video On Demand (VOD) streaming fully based on open web services in [Eyevinn Open Source Cloud](https://www.osaas.io). An open web service is based on open source giving you the option to host this entire solution in your own premises or cloud infrastructure. This solution features:

- Automatic generation of subtitles.
- Transcoding and creating VOD package for streaming in HLS and MPEG-DASH.
- Automated process triggered when a file is uploaded to a bucket and result stored in another bucket.

This repository contains the media supply chain orchestrator that will drive this process.

## Requirements

- An [Eyevinn Open Source Cloud account](https://app.osaas.io) on Professional plan.
- [NodeJS 20+ installed](https://nodejs.org/en/download).
- [Minio CLI installed](https://min.io/docs/minio/linux/reference/minio-mc.html).
- An OpenAI account and [OpenAI API access](https://platform.openai.com/docs/overview) (for automatic subtitling).

## Installation / Usage

We will setup and use the following open web services. Make sure you have activated these services or have remaining services available on your subscription plan:

- [MinIO Server](https://docs.osaas.io/osaas.wiki/Service%3A-MinIO.html)
- [SVT Encore](https://docs.osaas.io/osaas.wiki/Service%3A-SVT-Encore.html)
- [Subtitle Generator](https://docs.osaas.io/osaas.wiki/Service%3A-Subtitle-Generator.html)
- [Shaka Packager](https://docs.osaas.io/osaas.wiki/Service%3A-Shaka-Packager.html)

For creation of the instances we will use the Open Source Cloud CLI in this example. If you don't want to use the CLI you can use the Open Source Cloud web console instead.

### Store OSC Access Token in your environment

Obtain your OSC Access Token (your personal access token) from the web console in Settings/API page. Copy this value to the clipboard and save it in an environment variable called `OSC_ACCESS_TOKEN`.

```bash
% export OSC_ACCESS_TOKEN=<personal-access-token>
```

### Create MinIO server

Navigate to the [MinIO service](https://app.osaas.io/dashboard/service/minio-minio) in Open Source Cloud web console and create a service secret called `rootpassword` storing the password for the MinIO root user. It needs to be a mix of lowercase and uppercase and contain a number.

Create a MinIO server for the storage buckets we will use.

```bash
% npx -y @osaas/cli create minio-minio mediasupply \
  -o RootUser=root \
  -o RootPassword="{{secrets.rootpassword}}"
Instance created:
{
  name: 'mediasupply',
  url: '<minio-server-url>',
  ...
}
```

The URL to the MinIO server (`<minio-server-url>`) is the S3 Endpoint that will be referred to later in this guide. Create an alias for convience using the MinIO client.

```bash
%  mc alias set mediasupply <minio-server-url> root <minio-root-password>
```

Now we can create three buckets we will need.

```bash
% mc mb mediasupply/input
% mc mb mediasupply/abrsubs
% mc mb mediasupply/origin
```

### Create Subtitle Generator

Navigate to the [Subtitle Generator service](https://app.osaas.io/dashboard/service/eyevinn-auto-subtitles) in Open Source Cloud web console and create the following secrets:

- `openaikey` - Your OpenAI API key
- `miniopwd` - `<minio-root-password>`

Create a Subtitle Generator instance using the Open Source Cloud CLI (or the web console).

```bash
% npx -y @osaas/cli create eyevinn-auto-subtitles mediasupply \
  -o openaikey="{{secrets.openaikey}}" \
  -o awsAccessKeyId=root \
  -o awsSecretAccessKey="{{secrets.miniopwd}}" \
  -o s3Endpoint="<minio-server-url>"
Instance created:
{
  name: 'mediasupply',
  url: '<subtitle-generator-url>',
  ...
}  
```

### Create SVT Encore transcoder queue

Navigate to the [SVT Encore service](https://app.osaas.io/dashboard/service/encore) in Open Source web console and create the following secret:

- `miniopwd` - `<minio-root-password>`

Create an SVT Encore transcoding queue.

```bash
% npx -y @osaas/cli create encore mediasupply \
  -o s3AccessKeyId=root \
  -o s3SecretAccessKey="{{secrets.miniopwd}}" \
  -o s3Endpoint="<minio-server-url>"
Instance created:
{
  name: 'mediasupply',
  url: '<svtencore-url>',
  ...
}
```

### Configure Shaka Packager

Navigate to the [Shaka Packager service](https://app.osaas.io/dashboard/service/eyevinn-shaka-packager-s3) in web console and create the following secret:

- `miniopwd` - `<minio-root-password>`

### Run the Media Supply Chain Orchestrator

Now we can start the Media Supply Chain orchestrator that will automate this supply chain process. Start by storing some environment variables pointing to the service instances we created above.

```bash
% export OSC_ACCESS_TOKEN=<personal-access-token>
% export S3_ACCESS_KEY_ID=root
% export S3_SECRET_ACCESS_KEY="{{secrets.miniopwd}}
% export S3_ENDPOINT_URL=<minio-server-url>
% export ENCORE_URL=<svtencore-url>
% export SUBTITLE_GENERATOR_URL=<subtitle-generator-url>
```

Then start the orchestrator.

```
% npm start
```

## Development

<!--Add clear instructions on how to start development of the project here -->

## Contributing

See [CONTRIBUTING](CONTRIBUTING.md)

## License

This project is licensed under the MIT License, see [LICENSE](LICENSE).

# Support

Join our [community on Slack](http://slack.osaas.io/) where you can post any questions regarding any of our open source projects. Eyevinn's consulting business can also offer you:

- Further development of this component
- Customization and integration of this component into your platform
- Support and maintenance agreement

Contact [sales@eyevinn.se](mailto:sales@eyevinn.se) if you are interested.

# About Eyevinn Technology

[Eyevinn Technology](https://www.eyevinntechnology.se) help companies in the TV, media, and entertainment sectors optimize costs and boost profitability through enhanced media solutions.
We are independent in a way that we are not commercially tied to any platform or technology vendor. As our way to innovate and push the industry forward, we develop proof-of-concepts and tools. We share things we have learn and code as open-source.

With Eyevinn Open Source Cloud we enable to build solutions and applications based on Open Web Services and avoid being locked in with a single web service vendor. Our open-source solutions offer full flexibility with a revenue share model that supports the creators.

Read our blogs and articles here:

- [Developer blogs](https://dev.to/video)
- [Medium](https://eyevinntechnology.medium.com)
- [OSC](https://www.osaas.io)
- [LinkedIn](https://www.linkedin.com/company/eyevinn/)

Want to know more about Eyevinn, contact us at info@eyevinn.se!
