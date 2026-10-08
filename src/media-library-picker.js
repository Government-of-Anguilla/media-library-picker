/*!
 * Media Library Picker — UI layer
 * Renders the modal picker on top of a MediaLibraryCore instance.
 */
(function (global) {
	'use strict';

	if (!global.MediaLibraryCore) {
		throw new Error('MediaLibraryPicker requires media-library-core.js to be loaded first.');
	}

	const FILTER_LABELS = { image: 'Images', document: 'Documents', audio: 'Audio', video: 'Video' };

	/* ---------------------------------------------------------- DOM utils */
	function el(tag, props, children) {
		const node = document.createElement(tag);
		if (props) {
			Object.keys(props).forEach((key) => {
				const value = props[key];
				if (value == null || value === false) return;
				if (key === 'className') node.className = value;
				else if (key === 'dataset') Object.assign(node.dataset, value);
				else if (key.indexOf('on') === 0 && typeof value === 'function') {
					node.addEventListener(key.slice(2).toLowerCase(), value);
				} else if (key === 'html') {
					node.innerHTML = value;
				} else if (key === 'text') {
					node.textContent = value;
				} else {
					node.setAttribute(key, value === true ? '' : value);
				}
			});
		}
		(children || []).forEach((child) => {
			if (child == null) return;
			node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
		});
		return node;
	}

	function clear(node) {
		while (node.firstChild) node.removeChild(node.firstChild);
	}

	/* ------------------------------------------------------------- icons */
	const ICONS = {
		search:
			'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
		upload:
			'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5"/><path d="M5 12l7-7 7 7"/></svg>',
		sidebarToggle:
			'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2"/><line x1="14" y1="4" x2="14" y2="20"/></svg>',
		grid: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
		list: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>',
		close:
			'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="5" y1="5" x2="19" y2="19"/><line x1="19" y1="5" x2="5" y2="19"/></svg>',
		check:
			'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
		info: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><line x1="12" y1="11" x2="12" y2="16"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
		versions:
			'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h11a3 3 0 0 1 3 3v8"/><path d="M4 17h11a3 3 0 0 0 3-3V6"/></svg>',
		image:
			'<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>',
		video:
			'<svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor"><rect x="2" y="5" width="20" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><polygon points="10,9 16,12 10,15"/></svg>',
		audio:
			'<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
		pdf: '<svg width="32" height="32" viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="3" fill="#e0342c"/><text x="12" y="15.5" font-size="7.5" font-weight="700" fill="#fff" text-anchor="middle" font-family="Arial, sans-serif">PDF</text></svg>',
		doc: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#1e2a4a" stroke-width="1.6"><path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4"/><line x1="9.5" y1="12" x2="14.5" y2="12"/><line x1="9.5" y1="15.5" x2="14.5" y2="15.5"/></svg>',
		file: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4"/></svg>',
	};

	function iconFor(category, mime) {
		if (/pdf/.test(mime || '')) return ICONS.pdf;
		if (category === 'video') return ICONS.video;
		if (category === 'audio') return ICONS.audio;
		if (category === 'document') return ICONS.doc;
		return ICONS.file;
	}

	/* ------------------------------------------------------- the widget */
	class MediaLibraryPicker {
		constructor(options) {
			this.options = Object.assign(
				{
					multiple: false,
					defaultView: 'grid',
					closeOnBackdrop: true,
					callbacks: {},
					triggers: [],
				},
				options
			);
			this.callbacks = this.options.callbacks || {};
			this.core = this.options.core || new global.MediaLibraryCore(this.options);

			this.view = this.options.defaultView === 'list' ? 'list' : 'grid';
			this.sidebarCollapsed = false;
			this.activeDetailTab = 'details';
			this.isOpen = false;

			this._unsubs = [];
			this._buildDom();
			this._bindCoreEvents();
			this._bindGlobalKeys();
			this._bindTriggers(this.options.triggers);
		}

		/* ------------------------------------------------- public API ---- */
		open() {
			if (this.isOpen) return;
			this.isOpen = true;
			document.body.appendChild(this.overlay);
			requestAnimationFrame(() => this.overlay.classList.add('mlp-open'));
			this.core.fetchItems();
			this._fire('onOpen');
			setTimeout(() => this.searchInput.focus(), 50);
		}

		close() {
			if (!this.isOpen) return;
			this.isOpen = false;
			this.overlay.classList.remove('mlp-open');
			const node = this.overlay;
			setTimeout(() => {
				if (node.parentNode) node.parentNode.removeChild(node);
			}, 150);
			this._fire('onClose');
		}

		toggle() {
			this.isOpen ? this.close() : this.open();
		}

		destroy() {
			this._unsubs.forEach((fn) => fn());
			if (this.overlay.parentNode) this.overlay.parentNode.removeChild(this.overlay);
			this._triggerCleanups && this._triggerCleanups.forEach((fn) => fn());
		}

		/* -------------------------------------------------- internals ---- */
		_fire(name, payload) {
			const fn = this.callbacks[name];
			if (typeof fn === 'function') fn(payload);
		}

		_bindTriggers(triggers) {
			this._triggerCleanups = [];
			(triggers || []).forEach((trigger) => {
				const nodes =
					typeof trigger === 'string' ? Array.from(document.querySelectorAll(trigger)) : [trigger];
				nodes.forEach((node) => {
					if (!node) return;
					const handler = (e) => {
						e.preventDefault();
						this.open();
					};
					node.addEventListener('click', handler);
					this._triggerCleanups.push(() => node.removeEventListener('click', handler));
				});
			});
		}

		_bindGlobalKeys() {
			const handler = (e) => {
				if (!this.isOpen) return;
				if (e.key === 'Escape') {
					this.close();
				} else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
					e.preventDefault();
					this.searchInput.focus();
					this.searchInput.select();
				}
			};
			document.addEventListener('keydown', handler);
			this._unsubs.push(() => document.removeEventListener('keydown', handler));
		}

		_bindCoreEvents() {
			this._unsubs.push(this.core.on('items', () => this._renderItems()));
			this._unsubs.push(this.core.on('loading', (loading) => this._setLoading(loading)));
			this._unsubs.push(this.core.on('selection', (items) => this._renderSidebar(items)));
			this._unsubs.push(this.core.on('upload:start', () => this._renderUploads()));
			this._unsubs.push(this.core.on('upload:progress', () => this._renderUploads()));
			this._unsubs.push(
				this.core.on('upload:complete', (record) => {
					this._renderUploads();
					this._fire('onUploadComplete', record);
				})
			);
			this._unsubs.push(
				this.core.on('upload:error', (record) => {
					this._renderUploads();
					this._fire('onUploadError', record);
				})
			);
			this._unsubs.push(this.core.on('uploads', () => this._renderUploads()));
		}

		/* ------------------------------------------------------ building */
		_buildDom() {
			this.fileInput = el('input', {
				type: 'file',
				className: 'mlp-hidden-input',
				multiple: this.options.multiple ? 'multiple' : null,
				accept: this.options.accept || null,
				onchange: (e) => this._handleFilesChosen(e.target.files),
			});

			this.searchInput = el('input', {
				type: 'text',
				placeholder: 'Search media... (cmd+K)',
				oninput: (e) => this._handleSearch(e.target.value),
			});

			const searchBox = el('div', { className: 'mlp-search' }, [
				this._iconNode(ICONS.search),
				this.searchInput,
			]);

			this.tabsWrap = el('div', { className: 'mlp-tabs' });

			this.uploadBtn = el(
				'button',
				{ type: 'button', className: 'mlp-btn mlp-btn-primary', onclick: () => this.fileInput.click() },
				[this._iconNode(ICONS.upload), 'Upload']
			);

			this.sidebarToggleBtn = this._iconButton(ICONS.sidebarToggle, () => this._toggleSidebar());
			this.gridViewBtn = this._iconButton(ICONS.grid, () => this._setView('grid'));
			this.listViewBtn = this._iconButton(ICONS.list, () => this._setView('list'));
			this.closeBtn = this._iconButton(ICONS.close, () => this.close());

			const headerActions = el('div', { className: 'mlp-header-actions' }, [
				this.uploadBtn,
				el('div', { className: 'mlp-divider-dot' }),
				this.sidebarToggleBtn,
				this.gridViewBtn,
				this.listViewBtn,
				el('div', { className: 'mlp-header-sep' }),
				this.closeBtn,
			]);

			this.header = el('div', { className: 'mlp-header' }, [searchBox, this.tabsWrap, headerActions]);

			this.gridEl = el('div', { className: 'mlp-grid' });
			this.gridWrap = el('div', { className: 'mlp-grid-wrap' }, [this.gridEl]);

			this.uploadBar = el('div', { className: 'mlp-upload-bar', style: 'display:none;' });

			this.main = el('div', { className: 'mlp-main' }, [this.gridWrap, this.uploadBar]);

			this.sidebarBody = el('div', { className: 'mlp-sidebar-body' });
			this.detailsTabBtn = el(
				'button',
				{ type: 'button', className: 'mlp-sidebar-tab mlp-active', onclick: () => this._setDetailTab('details') },
				[this._iconNode(ICONS.info), 'Details']
			);
			this.versionsTabBtn = el(
				'button',
				{ type: 'button', className: 'mlp-sidebar-tab', onclick: () => this._setDetailTab('versions') },
				[this._iconNode(ICONS.versions), 'Versions']
			);
			this.sidebarTabs = el('div', { className: 'mlp-sidebar-tabs' }, [this.detailsTabBtn, this.versionsTabBtn]);
			this.sidebar = el('div', { className: 'mlp-sidebar' }, [this.sidebarTabs, this.sidebarBody]);

			this.body = el('div', { className: 'mlp-body' }, [this.main, this.sidebar]);

			this.modal = el('div', { className: 'mlp-modal' }, [this.header, this.body, this.fileInput]);

			this.overlay = el('div', { className: 'mlp-root mlp-overlay' }, [this.modal]);
			this.overlay.addEventListener('click', (e) => {
				if (e.target === this.overlay && this.options.closeOnBackdrop) this.close();
			});
			this.overlay.addEventListener('dragover', (e) => {
				e.preventDefault();
				this.overlay.classList.add('mlp-dragover');
			});
			this.overlay.addEventListener('dragleave', (e) => {
				if (e.target === this.overlay) this.overlay.classList.remove('mlp-dragover');
			});
			this.overlay.addEventListener('drop', (e) => {
				e.preventDefault();
				this.overlay.classList.remove('mlp-dragover');
				if (e.dataTransfer && e.dataTransfer.files.length) this._handleFilesChosen(e.dataTransfer.files);
			});

			this._renderTabs();
			this._renderSidebar([]);
			this._updateViewButtons();
		}

		_iconNode(svg) {
			const span = el('span', { html: svg });
			span.style.display = 'inline-flex';
			return span;
		}

		_iconButton(svg, onClick) {
			return el('button', { type: 'button', className: 'mlp-icon-btn', onclick: onClick }, [
				this._iconNode(svg),
			]);
		}

		/* ------------------------------------------------------- filters */
		_renderTabs() {
			clear(this.tabsWrap);
			const filters = ['all'].concat(this.core.availableFilters());
			filters.forEach((id) => {
				const label = id === 'all' ? 'All' : FILTER_LABELS[id] || id;
				const btn = el(
					'button',
					{
						type: 'button',
						className: 'mlp-tab' + (this.core.state.filter === id ? ' mlp-active' : ''),
						onclick: () => this._handleFilterChange(id),
					},
					[label]
				);
				this.tabsWrap.appendChild(btn);
			});
		}

		_handleFilterChange(id) {
			this.core.fetchItems({ filter: id });
			Array.from(this.tabsWrap.children).forEach((btn, i) => {
				const filters = ['all'].concat(this.core.availableFilters());
				btn.classList.toggle('mlp-active', filters[i] === id);
			});
		}

		_handleSearch(value) {
			clearTimeout(this._searchTimer);
			this._searchTimer = setTimeout(() => this.core.fetchItems({ search: value }), 200);
		}

		/* --------------------------------------------------------- view */
		_setView(mode) {
			this.view = mode;
			this._updateViewButtons();
			this._renderItems();
		}

		_updateViewButtons() {
			this.gridViewBtn.classList.toggle('mlp-active', this.view === 'grid');
			this.listViewBtn.classList.toggle('mlp-active', this.view === 'list');
		}

		_toggleSidebar() {
			this.sidebarCollapsed = !this.sidebarCollapsed;
			this.sidebar.style.display = this.sidebarCollapsed ? 'none' : '';
			this.sidebarToggleBtn.classList.toggle('mlp-active', this.sidebarCollapsed);
		}

		_setDetailTab(tab) {
			this.activeDetailTab = tab;
			this.detailsTabBtn.classList.toggle('mlp-active', tab === 'details');
			this.versionsTabBtn.classList.toggle('mlp-active', tab === 'versions');
			this._renderSidebar(this.core.selectedItems());
		}

		_setLoading(loading) {
			this.gridWrap.style.opacity = loading ? '0.5' : '1';
		}

		/* --------------------------------------------------------- items */
		_renderItems() {
			clear(this.gridEl);
			const items = this.core.state.items;

			if (!items.length) {
				this.gridEl.className = 'mlp-grid';
				this.gridEl.appendChild(
					el('div', { className: 'mlp-empty' }, ['No files found.'])
				);
				return;
			}

			if (this.view === 'list') {
				this.gridEl.className = 'mlp-list';
				items.forEach((item) => this.gridEl.appendChild(this._buildListRow(item)));
			} else {
				this.gridEl.className = 'mlp-grid';
				items.forEach((item) => this.gridEl.appendChild(this._buildTile(item)));
			}
		}

		_isSelected(item) {
			return this.core.state.selectedIds.indexOf(item.id) > -1;
		}

		_buildTile(item) {
			const category = this.core.categoryFromMime(item.mime);
			const selected = this._isSelected(item);

			const thumbInner = item.thumbnailUrl
				? el('img', { src: item.thumbnailUrl, alt: item.name })
				: el('div', { className: 'mlp-tile-icon-box' }, [this._iconNode(iconFor(category, item.mime))]);

			const thumb = el('div', { className: 'mlp-tile-thumb' }, [
				thumbInner,
				el('div', { className: 'mlp-tile-checkbox' }, [this._iconNode(ICONS.check)]),
			]);

			const children = [thumb];
			if (!item.thumbnailUrl) {
				children.push(el('div', { className: 'mlp-tile-name', title: item.name }, [item.name]));
			}

			const tile = el(
				'div',
				{ className: 'mlp-tile' + (selected ? ' mlp-selected' : ''), onclick: (e) => this._handleItemClick(item, e) },
				children
			);
			return tile;
		}

		_buildListRow(item) {
			const category = this.core.categoryFromMime(item.mime);
			const selected = this._isSelected(item);
			const thumb = el('div', { className: 'mlp-list-thumb' }, [
				item.thumbnailUrl
					? el('img', { src: item.thumbnailUrl, alt: item.name })
					: this._iconNode(iconFor(category, item.mime)),
			]);
			return el(
				'div',
				{
					className: 'mlp-list-row' + (selected ? ' mlp-selected' : ''),
					onclick: (e) => this._handleItemClick(item, e),
				},
				[
					thumb,
					el('div', { className: 'mlp-list-name' }, [item.name]),
					el('div', { className: 'mlp-list-meta' }, [this.core.formatBytes(item.size)]),
				]
			);
		}

		_handleItemClick(item, e) {
			this.core.select(item.id, { additive: e.metaKey || e.ctrlKey });
			this._renderItems();
			this._fire('onSelect', this.core.selectedItems());
		}

		/* ------------------------------------------------------- sidebar */
		_renderSidebar(selectedItems) {
			clear(this.sidebarBody);
			const item = (selectedItems && selectedItems[0]) || null;

			if (!item) {
				this.sidebarBody.appendChild(
					el('div', { className: 'mlp-sidebar-empty' }, ['Select a file to see its details.'])
				);
				return;
			}

			if (this.activeDetailTab === 'versions') {
				const versions = item.versions || [];
				if (!versions.length) {
					this.sidebarBody.appendChild(
						el('div', { className: 'mlp-sidebar-empty' }, ['No previous versions.'])
					);
					return;
				}
				versions.forEach((v) => {
					this.sidebarBody.appendChild(
						el('div', { className: 'mlp-prop-row' }, [
							el('span', { className: 'mlp-prop-label' }, [v.label || v.id]),
							el('span', { className: 'mlp-prop-value' }, [v.date || '']),
						])
					);
				});
				return;
			}

			const category = this.core.categoryFromMime(item.mime);
			const preview = el('div', { className: 'mlp-sidebar-preview' }, [
				item.thumbnailUrl
					? el('img', { src: item.thumbnailUrl, alt: item.name })
					: this._iconNode(iconFor(category, item.mime)),
			]);

			const props = [
				['Type', item.mimeLabel || item.mime || '—'],
				['Size', this.core.formatBytes(item.size) || '—'],
			];
			if (item.width && item.height) props.push(['Dimensions', item.width + ' × ' + item.height]);

			this.sidebarBody.appendChild(preview);
			this.sidebarBody.appendChild(el('div', { className: 'mlp-sidebar-filename' }, [item.name]));
			this.sidebarBody.appendChild(
				el('div', { className: 'mlp-sidebar-subtitle' }, ['Selected file details'])
			);
			this.sidebarBody.appendChild(el('div', { className: 'mlp-sidebar-section-label' }, ['Properties']));

			props.forEach(([label, value]) => {
				this.sidebarBody.appendChild(
					el('div', { className: 'mlp-prop-row' }, [
						el('span', { className: 'mlp-prop-label' }, [label]),
						el('span', { className: 'mlp-prop-value' }, [String(value)]),
					])
				);
			});

			const insertBtn = el(
				'button',
				{
					type: 'button',
					className: 'mlp-btn mlp-btn-primary mlp-btn-block',
					onclick: () => this._handleInsert(),
				},
				['Insert']
			);
			const deleteBtn = el(
				'button',
				{ type: 'button', className: 'mlp-btn-danger-link', onclick: () => this._handleDelete(item) },
				['Delete File']
			);

			this.sidebarBody.appendChild(el('div', { className: 'mlp-sidebar-actions' }, [insertBtn, deleteBtn]));
		}

		_handleInsert() {
			const items = this.core.selectedItems();
			if (!items.length) return;
			this._fire('onInsert', this.options.multiple ? items : items[0]);
			this.close();
		}

		_handleDelete(item) {
			this.core
				.deleteItem(item.id)
				.then(() => this._fire('onDelete', item))
				.catch((err) => this._fire('onUploadError', { error: err }));
		}

		/* -------------------------------------------------------- upload */
		_handleFilesChosen(fileList) {
			if (!fileList || !fileList.length) return;
			this.core.uploadFiles(fileList);
			this.fileInput.value = '';
		}

		_renderUploads() {
			const uploads = this.core.state.uploads;
			clear(this.uploadBar);
			if (!uploads.length) {
				this.uploadBar.style.display = 'none';
				return;
			}
			this.uploadBar.style.display = '';
			const current = uploads[0];
			const label =
				uploads.length > 1
					? 'Uploading ' + uploads.length + ' files… ' + current.name
					: 'Uploading 1 file… ' + current.name;

			this.uploadBar.appendChild(
				el('div', { className: 'mlp-upload-row' }, [
					el('div', { className: 'mlp-upload-icon' }, [this._iconNode(ICONS.image)]),
					el('div', { className: 'mlp-upload-text' }, [label]),
					el('div', { className: 'mlp-upload-percent' }, [Math.round(current.progress) + '%']),
				])
			);
			this.uploadBar.appendChild(
				el('div', { className: 'mlp-progress-track' }, [
					el('div', { className: 'mlp-progress-fill', style: 'width:' + current.progress + '%' }),
				])
			);
			this.uploadBar.appendChild(
				el('div', { className: 'mlp-upload-footer' }, [
					el(
						'button',
						{
							type: 'button',
							className: 'mlp-upload-cancel',
							onclick: () => this.core.cancelUpload(current.id),
						},
						['Cancel']
					),
				])
			);
		}
	}

	global.MediaLibraryPicker = MediaLibraryPicker;
})(typeof window !== 'undefined' ? window : this);
