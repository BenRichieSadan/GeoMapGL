/**
 * Geo Map GL main widget file
 * Developed By: Ben Richie Sadan @ Sisense
 * Version : 1.0.0
 */

prism.registerWidget("GeoMapGL", {
	name: "GeoMapGL",
	family: "Map",
	title: "Geo Map GL",
	iconSmall: "/plugins/GeoMapGL/GeoMapGL-icon-small.png",
	styleEditorTemplate: "/plugins/GeoMapGL/styler.html",
	hideNoResults: true,
	directive: {
		desktop: "GeoMapGL"
	},
	style: {
		defaultIdleOpacity: 0.7,
		defaultIdleNoDataOpacity: 0.0,
		defaultHoverOpacity: 0.7,
		defaultIdleColor: '#FFFFFF',
		defaultHoverColor: '#FFFFFF',
		renderWorldCopies: false,
		baseMap: 'mapbox://styles/mapbox/streets-v11',
		defaultGeoJsonsLoad: {
			Countries: false,
			StatesAndProvinces: false
		},
		CustomGeoJsonsInfo: []
	},
	data: {
		selection: [],
		defaultQueryResult: {},
		panels: [{
				name: 'Identifier',
				type: "visible",
				metadata: {
					types: ['dimensions'],
					maxitems: 1
				},
				visibility: true
			},
			{
				name: 'Value',
				type: "visible",
				itemAttributes: ["color"],
				allowedColoringTypes: function () {
					return {
						color: true,
						condition: true,
						range: true
					};
				},
				metadata: {
					types: ['measures'],
					maxitems: 1
				},
				itemAdded: function (widget, item) {
					var ColorValue = 0;
				},
				visibility: true
			},
			{
				name: 'filters',
				type: 'filters',
				metadata: {
					types: ['measures'],
					maxitems: -1
				}
			}
		],
		canColor: function (widget, panel, item) {
			if (panel.name == "Value") {
				return true;
			} else {
				return false;
			}
		},
		// builds a jaql query from the given widget
		buildQuery: function (widget) {
			// building jaql query object from widget metadata 
			var query = {
				datasource: widget.datasource,
				format: "json",
				isMaskedResult: true,
				metadata: []
			};

			if (widget.metadata.panel("Identifier").items.length > 0) {
				var curPanel = widget.metadata.panel("Identifier").items[0];
				curPanel.PanelName = "Identifier";
				query.metadata.push(curPanel);
			}

			if (widget.metadata.panel("Value").items.length > 0) {
				var curPanel = widget.metadata.panel("Value").items[0];
				curPanel.PanelName = "Value";
				query.metadata.push(curPanel);
			}

			//pushing filters
			if (defined(widget.metadata.panel("filters"), 'items.0')) {
				widget.metadata.panel('filters').items.forEach(function (item) {

					item = $$.object.clone(item, true);
					item.panel = "scope";
					query.metadata.push(item);
				});
			}
			return query;
		},
		processResult: function (widget, queryResult) {
			queryResult.mapData = constructLayerData(queryResult.$$rows, 0, 1);
			return queryResult;
		},
	},
	/**
	 * Get all the connected dimentions selected filters
	 * @param {*} widget 
	 * @param {*} event 
	 */
	beforequery(widget, event) {
		if (!event.query.metadata.length) {
			return;
		}

		let newMetadata = [];

		let isoPanel = widget.metadata.panel("Identifier").items[0];

		for (let index = 0; index < event.query.metadata.length; index++) {
			let element = event.query.metadata[index];

			if (element.panel == "scope") {
				if (isoPanel.jaql.dim != element.jaql.dim) {
					newMetadata[newMetadata.length] = element;
				}
			} else {
				newMetadata[newMetadata.length] = element;
			}
		}

		event.query.metadata = newMetadata;
	},
	render: function (widget, event) {
		generateMap(widget, event);
	},
	options: {
		dashboardFiltersMode: "highlight",
		selector: false,
		title: false
	}
});