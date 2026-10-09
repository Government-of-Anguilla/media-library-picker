# Media Library Picker

Media Library Picker is a modern, lightweight file management interface built with vanilla JavaScript principles in mind. No frameworks, no build step required to use it.

![Media Library Picker](screen-1.png)

The plugin consists of:

- `src/media-library.css` — stylesheet
- `src/media-library-core.js` — headless core (state, API calls, uploads, events)
- `src/media-library-picker.js` — the popup media picker UI, built on top of the core
- `dist/media-library.min.js` — core + picker, combined and minified for production use
- `dist/media-library.min.css` — minified stylesheet

## Quick start

```html
<link rel="stylesheet" href="dist/media-library.min.css" />
<script src="dist/media-library.min.js"></script>

<button id="open-picker">Open Media Library</button>

<script>
	const picker = new MediaLibraryPicker({
		multiple: false,
		filters: ['image', 'document', 'audio', 'video'],
		triggers: ['#open-picker'],
		endpoints: {
			list: '/api/media', // GET  ?filter=&search=&pageSize= -> { items } or [ items ]
			upload: '/api/media/upload', // POST multipart/form-data, field "file" -> item
			delete: '/api/media/:id', // DELETE -> 2xx
			detail: '/api/media/:id', // GET -> item (optional, used for versions)
		},
		callbacks: {
			onOpen() {},
			onClose() {},
			onSelect(items) {},
			onInsert(item) {}, // fired on "Insert" click, then the picker closes
			onDelete(item) {},
			onUploadComplete(record) {},
			onUploadError(record) {},
		},
	});

	// also callable programmatically:
	// picker.open();
	// picker.close();
</script>
```

With no `endpoints.list` configured, the widget runs against a small built-in demo dataset so it's explorable immediately — see `demo/index.html`.

## Configuration

| Option | Type | Description |
| --- | --- | --- |
| `endpoints.list` | `string` | GET endpoint returning files. Accepts `filter`, `search`, `pageSize` query params. |
| `endpoints.upload` | `string` | POST endpoint accepting `multipart/form-data` (field `file`). Upload progress is tracked via `XMLHttpRequest`. |
| `endpoints.delete` | `string` | DELETE endpoint, `:id` is replaced with the file id. |
| `endpoints.detail` | `string` | GET endpoint for a single file's detail/versions, `:id` is replaced with the file id. |
| `filters` | `string[]` | Which category tabs to show, any of `image`, `document`, `audio`, `video`. |
| `multiple` | `boolean` | Allow multi-select (cmd/ctrl+click) and multi-file upload. |
| `accept` | `string` | Passed to the native file input's `accept` attribute. |
| `headers` | `object` | Extra headers sent with every request (e.g. an auth token). |
| `withCredentials` | `boolean` | Send cookies with requests. |
| `triggers` | `(string\|Element)[]` | Selectors or elements that open the picker on click. |
| `callbacks` | `object` | See above — `onOpen`, `onClose`, `onSelect`, `onInsert`, `onDelete`, `onUploadComplete`, `onUploadError`. |

Files can also be dropped directly onto the picker window to upload them.

## Using the headless core directly

`media-library-core.js` has no DOM/UI code — it only talks to your API, tracks state, and emits events. Use it on its own when you want to build your own picker UI, a media display/gallery page, or integrate into a framework (React, Vue, etc.) instead of the built-in popup.

```html
<script src="src/media-library-core.js"></script>

<script>
	const core = new MediaLibraryCore({
		endpoints: {
			list: '/api/media',
			upload: '/api/media/upload',
			delete: '/api/media/:id',
		},
	});

	// React to state changes and render however you like.
	core.on('items', (items) => renderGrid(items));
	core.on('selection', (items) => console.log('selected', items));
	core.on('upload:progress', (record) => console.log(record.name, record.progress));
	core.on('error', (err) => console.error(err));

	// Load the list.
	core.fetchItems();

	function renderGrid(items) {
		const grid = document.getElementById('grid');
		grid.innerHTML = items
			.map((item) => `<div class="item" data-id="${item.id}">${item.name} (${core.formatBytes(item.size)})</div>`)
			.join('');
	}

	// Delegate clicks on the rendered grid back to the core, passing the
	// item's data id (item.id) — NOT a DOM element id.
	document.getElementById('grid').addEventListener('click', (e) => {
		const el = e.target.closest('.item');
		if (!el) return;
		core.select(el.dataset.id, { additive: e.metaKey || e.ctrlKey });
	});

	// Upload file(s) from an <input type="file"> or drop event.
	document.getElementById('file-input').addEventListener('change', (e) => {
		core.uploadFiles(e.target.files);
	});

	// Delete uses the same item.id, e.g. from a delete button inside the item:
	// core.deleteItem(item.id);
</script>
```

`core.select(id)` / `core.deleteItem(id)` always take the item's `id` field from the data (`item.id`), never an HTML element id — the core has no knowledge of your DOM. The usual pattern is to stash `item.id` on each rendered element (e.g. a `data-id` attribute, as above) and read it back in your click handler, as shown with the delegated listener on `#grid`.

Selection state lives on the core (`state.selectedIds`), not in the DOM — after calling `core.select()`, use the `selection` event (or `core.selectedItems()`) to re-render which elements look "selected" (e.g. toggle a CSS class), rather than tracking it separately in your markup.

With no `endpoints.list` configured, `fetchItems()` resolves against the same built-in demo dataset the full picker uses, so you can build/test a custom UI without a backend.

### Core API

| Method | Description |
| --- | --- |
| `fetchItems({ filter, search })` | Loads items from `endpoints.list` (or demo data). Updates `state.items` and emits `loading` / `items` / `error`. |
| `fetchDetail(id)` | Loads a single item from `endpoints.detail`, or falls back to the already-loaded item. |
| `uploadFiles(fileList)` | Uploads one or more files to `endpoints.upload` via `XMLHttpRequest`. Returns upload records; emits `upload:start`, `upload:progress`, `upload:complete`/`upload:error`, `uploads`. |
| `cancelUpload(uploadId)` | Aborts an in-progress upload. |
| `deleteItem(id)` | Deletes via `endpoints.delete`, removes it from state, emits `items` / `selection` / `delete`. |
| `select(id, { additive })` | Toggles selection; `additive: true` (with `multiple: true`) adds/removes instead of replacing. |
| `clearSelection()` | Clears `state.selectedIds`. |
| `selectedItems()` | Returns the currently selected item objects. |
| `categoryFromMime(mime)` / `formatBytes(bytes)` | Formatting helpers used internally, safe to reuse in your own UI. |

### Events

`loading`, `items`, `error`, `selection`, `upload:start`, `upload:progress`, `upload:complete`, `upload:error`, `upload:cancel`, `uploads`, `delete`.

So yes — fetching the list, uploading, and deleting are all exposed directly on `MediaLibraryCore`, independent of the bundled picker UI.

## Development

```sh
npm install
npm run build   # regenerates dist/media-library.min.js and dist/media-library.min.css
```

Open `demo/index.html` (via a static file server, e.g. `npx http-server .`) to try the picker against the built-in demo dataset.
