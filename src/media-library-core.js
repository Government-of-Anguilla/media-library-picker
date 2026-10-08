/*!
 * Media Library Core
 * Headless state/data engine for the Media Library Picker.
 * No DOM dependencies — talks to your API, tracks state, emits events.
 */
(function (global) {
	'use strict';

	/* ----------------------------------------------------------------------
	 * Minimal event emitter
	 * -------------------------------------------------------------------- */
	class EventEmitter {
		constructor() {
			this._listeners = Object.create(null);
		}

		on(event, handler) {
			(this._listeners[event] || (this._listeners[event] = [])).push(handler);
			return () => this.off(event, handler);
		}

		off(event, handler) {
			const list = this._listeners[event];
			if (!list) return;
			const i = list.indexOf(handler);
			if (i > -1) list.splice(i, 1);
		}

		emit(event, payload) {
			const list = this._listeners[event];
			if (!list) return;
			list.slice().forEach((fn) => {
				try {
					fn(payload);
				} catch (err) {
					/* eslint-disable no-console */
					console.error('[MediaLibraryCore] listener for "' + event + '" threw:', err);
				}
			});
		}
	}

	/* ----------------------------------------------------------------------
	 * File category helpers
	 * -------------------------------------------------------------------- */
	const CATEGORY_DEFS = [
		{ id: 'image', label: 'Images', test: (mime) => /^image\//.test(mime) },
		{ id: 'video', label: 'Video', test: (mime) => /^video\//.test(mime) },
		{ id: 'audio', label: 'Audio', test: (mime) => /^audio\//.test(mime) },
		{
			id: 'document',
			label: 'Documents',
			test: (mime) => /pdf|msword|officedocument|text\/|rtf|csv/.test(mime),
		},
	];

	function categoryFromMime(mime) {
		if (!mime) return 'document';
		const found = CATEGORY_DEFS.find((c) => c.test(mime));
		return found ? found.id : 'document';
	}

	function formatBytes(bytes) {
		if (bytes == null || isNaN(bytes)) return '';
		if (bytes === 0) return '0 B';
		const units = ['B', 'KB', 'MB', 'GB', 'TB'];
		const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
		const value = bytes / Math.pow(1024, i);
		return (i === 0 ? value : value.toFixed(1)) + ' ' + units[i];
	}

	/* ----------------------------------------------------------------------
	 * Demo dataset — used whenever no `endpoints.list` is configured, so the
	 * widget is immediately explorable without a backend.
	 * -------------------------------------------------------------------- */
	function buildDemoItems() {
		const now = Date.now();
		return [
			{ id: 'demo-1', name: 'summer-beach-sunset.jpg', mime: 'image/jpeg', size: 1258291, width: 2000, height: 1333, thumbnailUrl: null, createdAt: now },
			{ id: 'demo-2', name: 'living-room-interior.jpg', mime: 'image/jpeg', size: 982451, width: 1800, height: 1200, thumbnailUrl: null, createdAt: now },
			{ id: 'demo-3', name: 'Q3_Financial_Report.pdf', mime: 'application/pdf', size: 452331, thumbnailUrl: null, createdAt: now },
			{ id: 'demo-4', name: 'Interview_Recording.mp3', mime: 'audio/mpeg', size: 3145728, thumbnailUrl: null, createdAt: now },
			{ id: 'demo-5', name: 'headshot-portrait.jpg', mime: 'image/jpeg', size: 845213, width: 1600, height: 1600, thumbnailUrl: null, createdAt: now },
			{ id: 'demo-6', name: 'Product_Demo_Final.mp4', mime: 'video/mp4', size: 15728640, thumbnailUrl: null, createdAt: now },
			{ id: 'demo-7', name: 'notebook-desk.jpg', mime: 'image/jpeg', size: 712480, width: 1700, height: 1133, thumbnailUrl: null, createdAt: now },
			{ id: 'demo-8', name: 'Project_Proposal_Draft.docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: 198432, thumbnailUrl: null, createdAt: now },
		];
	}

	const DEFAULTS = {
		endpoints: {
			list: null, // GET  (params: search, filter, page, pageSize) -> { items, total }
			upload: null, // POST (multipart/form-data, field "file")        -> item
			delete: null, // DELETE :id                                      -> void
			detail: null, // GET  :id                                        -> item (versions, etc.)
		},
		filters: ['image', 'document', 'audio', 'video'],
		pageSize: 60,
		multiple: false,
		headers: {},
		withCredentials: false,
	};

	class MediaLibraryCore extends EventEmitter {
		constructor(options) {
			super();
			this.options = Object.assign({}, DEFAULTS, options);
			this.options.endpoints = Object.assign({}, DEFAULTS.endpoints, (options && options.endpoints) || {});

			this.state = {
				items: [],
				selectedIds: [],
				filter: 'all',
				search: '',
				loading: false,
				error: null,
				uploads: [],
			};

			this._usesDemoData = !this.options.endpoints.list;
			this._requestToken = 0;
		}

		/* ---------------- category / formatting helpers (static-ish) ---- */
		categoryFromMime(mime) {
			return categoryFromMime(mime);
		}

		formatBytes(bytes) {
			return formatBytes(bytes);
		}

		availableFilters() {
			return this.options.filters.filter((id) => CATEGORY_DEFS.some((c) => c.id === id));
		}

		/* ---------------- data loading ----------------------------------- */
		async fetchItems(overrides) {
			const token = ++this._requestToken;
			this.state.loading = true;
			this.state.error = null;
			this.emit('loading', true);

			const filter = (overrides && overrides.filter) || this.state.filter;
			const search = overrides && overrides.search !== undefined ? overrides.search : this.state.search;
			this.state.filter = filter;
			this.state.search = search;

			try {
				let items;
				if (this.options.endpoints.list) {
					items = await this._requestList({ filter, search });
				} else {
					items = this._filterDemoItems(buildDemoItems(), filter, search);
				}

				if (token !== this._requestToken) return; // stale response

				this.state.items = items;
				this.state.loading = false;
				this.emit('loading', false);
				this.emit('items', items);
				return items;
			} catch (err) {
				if (token !== this._requestToken) return;
				this.state.loading = false;
				this.state.error = err;
				this.emit('loading', false);
				this.emit('error', err);
				throw err;
			}
		}

		_filterDemoItems(items, filter, search) {
			const q = (search || '').trim().toLowerCase();
			return items.filter((item) => {
				const cat = categoryFromMime(item.mime);
				const matchesFilter = filter === 'all' || cat === filter;
				const matchesSearch = !q || item.name.toLowerCase().includes(q);
				return matchesFilter && matchesSearch;
			});
		}

		async _requestList({ filter, search }) {
			const url = new URL(this.options.endpoints.list, global.location ? global.location.href : undefined);
			if (filter && filter !== 'all') url.searchParams.set('filter', filter);
			if (search) url.searchParams.set('search', search);
			if (this.options.pageSize) url.searchParams.set('pageSize', this.options.pageSize);

			const res = await fetch(url.toString(), {
				method: 'GET',
				headers: this.options.headers,
				credentials: this.options.withCredentials ? 'include' : 'same-origin',
			});
			if (!res.ok) throw new Error('Failed to load media (HTTP ' + res.status + ')');
			const data = await res.json();
			return Array.isArray(data) ? data : data.items || [];
		}

		async fetchDetail(id) {
			if (!this.options.endpoints.detail) {
				return this.state.items.find((i) => i.id === id) || null;
			}
			const url = this.options.endpoints.detail.replace(':id', encodeURIComponent(id));
			const res = await fetch(url, {
				headers: this.options.headers,
				credentials: this.options.withCredentials ? 'include' : 'same-origin',
			});
			if (!res.ok) throw new Error('Failed to load file detail (HTTP ' + res.status + ')');
			return res.json();
		}

		/* ---------------- selection -------------------------------------- */
		select(id, opts) {
			const additive = opts && opts.additive && this.options.multiple;
			const isOnlySelected = this.state.selectedIds.length === 1 && this.state.selectedIds[0] === id;
			if (additive) {
				const idx = this.state.selectedIds.indexOf(id);
				if (idx > -1) this.state.selectedIds.splice(idx, 1);
				else this.state.selectedIds.push(id);
			} else if (isOnlySelected) {
				this.state.selectedIds = [];
			} else {
				this.state.selectedIds = [id];
			}
			this.emit('selection', this.selectedItems());
		}

		clearSelection() {
			this.state.selectedIds = [];
			this.emit('selection', []);
		}

		selectedItems() {
			const set = new Set(this.state.selectedIds);
			return this.state.items.filter((i) => set.has(i.id));
		}

		/* ---------------- delete ------------------------------------------ */
		async deleteItem(id) {
			if (this.options.endpoints.delete) {
				const url = this.options.endpoints.delete.replace(':id', encodeURIComponent(id));
				const res = await fetch(url, {
					method: 'DELETE',
					headers: this.options.headers,
					credentials: this.options.withCredentials ? 'include' : 'same-origin',
				});
				if (!res.ok) throw new Error('Failed to delete file (HTTP ' + res.status + ')');
			}
			this.state.items = this.state.items.filter((i) => i.id !== id);
			this.state.selectedIds = this.state.selectedIds.filter((sid) => sid !== id);
			this.emit('items', this.state.items);
			this.emit('selection', this.selectedItems());
			this.emit('delete', id);
			return true;
		}

		/* ---------------- upload ------------------------------------------- */
		uploadFiles(fileList) {
			const files = Array.from(fileList || []);
			return files.map((file) => this._uploadOne(file));
		}

		_uploadOne(file) {
			const uploadId = 'upload-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
			const record = { id: uploadId, file, name: file.name, progress: 0, status: 'uploading' };
			this.state.uploads.push(record);
			this.emit('upload:start', record);
			this.emit('uploads', this.state.uploads);

			const finish = (status, extra) => {
				record.status = status;
				this.state.uploads = this.state.uploads.filter((u) => u.id !== uploadId);
				this.emit('uploads', this.state.uploads);
				if (status === 'done') {
					if (extra && extra.item) this.state.items = [extra.item, ...this.state.items];
					this.emit('upload:complete', Object.assign({}, record, extra));
					this.emit('items', this.state.items);
				} else if (status === 'error') {
					this.emit('upload:error', Object.assign({}, record, extra));
				} else if (status === 'cancelled') {
					this.emit('upload:cancel', record);
				}
			};

			if (!this.options.endpoints.upload) {
				// Demo mode: fabricate a progress sequence so the UI is testable
				// without a real backend.
				record.xhr = null;
				record.cancel = () => {
					clearInterval(timer);
					finish('cancelled');
				};
				const timer = setInterval(() => {
					record.progress = Math.min(100, record.progress + 12 + Math.random() * 10);
					this.emit('upload:progress', record);
					if (record.progress >= 100) {
						clearInterval(timer);
						const item = {
							id: uploadId,
							name: file.name,
							mime: file.type || 'application/octet-stream',
							size: file.size,
							thumbnailUrl: /^image\//.test(file.type) ? URL.createObjectURL(file) : null,
							createdAt: Date.now(),
						};
						finish('done', { item });
					}
				}, 180);
				return record;
			}

			const xhr = new XMLHttpRequest();
			record.xhr = xhr;
			record.cancel = () => xhr.abort();

			const formData = new FormData();
			formData.append('file', file, file.name);

			xhr.upload.addEventListener('progress', (evt) => {
				if (!evt.lengthComputable) return;
				record.progress = (evt.loaded / evt.total) * 100;
				this.emit('upload:progress', record);
			});

			xhr.addEventListener('load', () => {
				if (xhr.status >= 200 && xhr.status < 300) {
					let item = null;
					try {
						item = JSON.parse(xhr.responseText);
					} catch (e) {
						item = { id: uploadId, name: file.name, mime: file.type, size: file.size };
					}
					finish('done', { item });
				} else {
					finish('error', { error: new Error('Upload failed (HTTP ' + xhr.status + ')') });
				}
			});

			xhr.addEventListener('error', () => finish('error', { error: new Error('Upload failed') }));
			xhr.addEventListener('abort', () => finish('cancelled'));

			xhr.open('POST', this.options.endpoints.upload, true);
			xhr.withCredentials = !!this.options.withCredentials;
			Object.keys(this.options.headers || {}).forEach((key) => {
				xhr.setRequestHeader(key, this.options.headers[key]);
			});
			xhr.send(formData);

			return record;
		}

		cancelUpload(uploadId) {
			const record = this.state.uploads.find((u) => u.id === uploadId);
			if (record && record.cancel) record.cancel();
		}
	}

	MediaLibraryCore.CATEGORY_DEFS = CATEGORY_DEFS;
	MediaLibraryCore.formatBytes = formatBytes;
	MediaLibraryCore.categoryFromMime = categoryFromMime;

	global.MediaLibraryCore = MediaLibraryCore;
})(typeof window !== 'undefined' ? window : this);
