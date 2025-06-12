# Workflow Definition file

A workflow definition file is a YAML file describing the steps to perform when a file create event is received. This example defines that an `ABR_TRANSCODE` and `TRANSCRIBE` will be executed in parallell and as it has no dependencies they will be executed immediately. The step `VOD_PACKAGE` depends on that both `ABR_TRANSCODE` and `TRANSCRIBE` have completed. Last step is the `CLEANUP` step which depends on the `VOD_PACKAGE` to be completed.

```yml
steps:
  - type: ABR_TRANSCODE
    dependsOn: []
  - type: VOD_PACKAGE
    dependsOn:
      - ABR_TRANSCODE
      - TRANSCRIBE
  - type: TRANSCRIBE
    dependsOn: []
  - type: CLEANUP
    dependsOn:
      - VOD_PACKAGE
```

If you want to skip transcription you write the following:

```yml
steps:
  - type: ABR_TRANSCODE
    dependsOn: []
  - type: VOD_PACKAGE
    dependsOn:
      - ABR_TRANSCODE
  - type: CLEANUP
    dependsOn:
      - VOD_PACKAGE
```

## Steps

Supported steps are shown in the table below.

| Type | Description |
| ---- | ----------- |
| `ABR_TRANSCODE` | Transcode source file to a set of variants with different bitrates and resolutions. |
| `TRANSCRIBE` | From the source file transcribe and generates subtitles. |
| `VOD_PACKAGE` | Create a VOD package for streaming. |
| `CLEANUP` | Remove source file from input bucket and files created on temporary storage. |

