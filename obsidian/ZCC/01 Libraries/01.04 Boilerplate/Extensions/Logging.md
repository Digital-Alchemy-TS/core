## Future Enhancements

### AsyncLocalStorage

#Mental-Note/Enhancement

Add support for `AsyncLocalStorage` based options for additional log context for the source of the event that kicked off a given workflow

- [[01 Libraries/01.09 Support/Server/Server|Server]] - http request id
- [[Scheduler]] - scheduled events
- [[Websocket API]] - home assistant based events
- [[Sequence Watcher]]
- [[Solar Calculator]]

There are a few individual sources for this data, it may be end up being a better long term solution to spin out [[Safe Execution]] into it's own extension, and working more closely with that 