/**
 * Geo Map GL main logic file
 * Developed By: Ben Richie Sadan @ Sisense
 * Version : 1.0.0
 */

var holdingWidget;

var mapHolder;

var mapGL;

var lastSelection;

var popup;

function constructLayerData(data, layerIndex, totalLayers) {
    if (data == null) {
        return null;
    }

    let dataConstruct = groupBy(data, layerIndex, false);

    return dataConstruct;
}

function groupBy(data, key, collectValues, parentKey) { // `data` is an array of objects, `key` is the key (or property accessor) to group by
    // reduce runs this anonymous function on each element of `data` (the `item` parameter,
    // returning the `storage` parameter at the end

    return data.reduce(function (storage, item) {
        // get the first instance of the key by which we're grouping
        let group = item[key].data;

        // set `storage` for this instance of group to the outer scope (if not empty) or initialize it
        storage[group] = storage[group] || [];

        let structuredData = {
            data: item[1]
        }

        // add this item to its group within `storage`
        storage[group].push(structuredData);

        // return the updated storage to the reduce function, which will then loop through the next 
        return storage;
    }, {}); // {} is the initial value of the storage
};

function generateMap(widget, event) {
    holdingWidget = widget;

    if (mapGL == null || event.reason == 'widgetredraw') {
        rebuildMap(widget, event);
    } else {
        let curStyle = mapGL.getStyle();
        let curBaseMapName = curStyle.sprite.split('/')[4];
        let styleBaseMapName = widget.style.baseMap.split('/')[4];

        if (curBaseMapName != styleBaseMapName) {
            mapGL.on('style.load', mapGLLoaded);

            mapGL.setStyle(widget.style.baseMap);
        } else {
            mapGL.resize();

            let geoJsonData = updateMapData(countriesGeoLayers);

            if (mapGL.getSource('countries') != null) {
                mapGL.getSource('countries').setData(geoJsonData);
            }
        }
    }
}

function rebuildMap(widget, event) {
    if (mapGL != null) {
        mapGL.remove();

        mapGL = null;
    }

    if (mapHolder == null) {
        mapHolder = document.createElement('div');
        mapHolder.id = 'MapboxGlWidMap-' + widget.oid;
        mapHolder.style.height = '100%';
        mapHolder.style.width = '100%';

        holdingWidget = widget;
        var element = $(event.element);
        // 	Get widget element, and clear it out
        element.empty();

        element.append(mapHolder);
    } else {
        if (event.element != null) {
            $(event.element).append(mapHolder);
        }
    }

    // TO MAKE THE MAP APPEAR YOU MUST
    // ADD YOUR ACCESS TOKEN FROM
    // https://account.mapbox.com
    mapboxgl.accessToken = settings.apiToken;
    mapGL = new mapboxgl.Map({
        container: mapHolder,
        style: widget.style.baseMap,
        center: [0, 0],
        zoom: 1,
        renderWorldCopies: widget.style.renderWorldCopies
    });

    mapGL.on("load", mapGLLoaded);
}

//  Custom Mapbox Control for Resetting filters
class clearFilterControl {
    onAdd(map) {

        //  Set the map
        this.map = map;

        //  Create HTML elements
        var myButtonGroup = $('<div class="mapboxgl-ctrl mapboxgl-ctrl-group"></div>'),
            myButton = $('<button class="clear-filter-button" type="button" style="width: auto" aria-label="Reset">Reset</button>');

        //  Add event handler
        myButton.on('click', function () {
            clearSelection();

            mapGL.setBearing(0);

            mapGL.setPitch(0);

            mapGL.flyTo({
                center: [0, 0],
                zoom: 1
            });
        });

        //  append button to group
        myButtonGroup.append(myButton);

        //  Assign as the container
        this.container = myButtonGroup[0];

        return this.container;
    }
    onRemove() {
        this.container.parentNode.removeChild(this.container);
        this.map = undefined;
    }
}

function mapGLLoaded() {
    //  Safely add the control
    while (mapGL._controls.length >= 3) {
        mapGL.removeControl(mapGL._controls[2]);
    }

    // Add zoom and rotation controls to the map.
    mapGL.addControl(new mapboxgl.NavigationControl({
        showCompass: true,
        showZoom: true,
        visualizePitch: true
    }), 'top-right');

    // Add zoom and rotation controls to the map.
    mapGL.addControl(new clearFilterControl(), 'top-left');

    initializeMapSources();
}

function updateMapData(baseGeoJsonData) {
    // make a copy of the base geoJson data
    let returnVal = JSON.parse(JSON.stringify(baseGeoJsonData));

    for (let index = 0; index < returnVal.features.length; index++) {
        let curFeature = returnVal.features[index];
        if (isNaN(curFeature.id) == true) {
            curFeature.properties['Identifier'] = curFeature.id;
            curFeature.id = index;
            curFeature.properties['id'] = curFeature.id;
        }

        curFeature.properties['color'] = getFeatureColorByIdentifier(curFeature.properties['Identifier']);

        let checkData = getFeatureDataByIdentifier(curFeature.properties['Identifier']);

        if (checkData != null) {
            curFeature.properties['opacity'] = holdingWidget.style.defaultHoverOpacity;
        } else {
            curFeature.properties['opacity'] = holdingWidget.style.defaultIdleNoDataOpacity;
        }
    }

    return returnVal;
}

var hoveredStateId = null;

function initializeMapSources() {
    let geoJsonData = updateMapData(countriesGeoLayers);

    mapGL.addSource('countries', {
        'type': 'geojson',
        'data': geoJsonData
    });

    displayLayer('countries-fills', 'countries', {
        'fill-color': ['get', 'color'],
        'fill-opacity': ['get', 'opacity']
    });

    displayLayer('countries-highlights', 'countries', {
        'fill-color': [
            'case',
            ['boolean', ['feature-state', 'hover'], false],
            '#ffffff',
            '#627BC1'
        ],
        'fill-opacity': [
            'case',
            ['boolean', ['feature-state', 'hover'], false],
            holdingWidget.style.defaultHoverOpacity,
            0.0
        ]
    });

    var popupOffsets = {
        'top': [0, -80],
        'top-left': [0, 0],
        'top-right': [0, 0]
    };

    // Create a popup, but don't add it to the map yet.
    popup = new mapboxgl.Popup({
        closeButton: false,
        closeOnClick: false,
        offset: popupOffsets
    });

    // When the user moves their mouse over the state-fill layer, we'll update the
    // feature state for the feature under the mouse.
    mapGL.on('mousemove', 'countries-highlights', function (e) {
        if (e.features.length > 0) {
            if (hoveredStateId != null) {
                mapGL.setFeatureState({
                    source: 'countries',
                    id: hoveredStateId
                }, {
                    hover: false
                });
            }
            hoveredStateId = e.features[0].id;
            mapGL.setFeatureState({
                source: 'countries',
                id: hoveredStateId
            }, {
                hover: true
            });

            let data = getFeatureDataByIdentifier(e.features[0].properties.Identifier);

            var coordinates = [e.lngLat.lng, e.lngLat.lat];
            var description = e.features[0].properties.name + ': ';

            if (data != null && data.data != null) {
                description += +data.data;
            } else {
                description += 'No Data';
            }

            // Ensure that if the map is zoomed out such that multiple
            // copies of the feature are visible, the popup appears
            // over the copy being pointed to.
            while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
                coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
            }

            mapGL.getCanvas().style.cursor = 'pointer';

            // Populate the popup and set its coordinates
            // based on the feature found.
            popup
                .setLngLat(coordinates)
                .setHTML(description)
                .addTo(mapGL);
        }
    });

    // When the mouse leaves the state-fill layer, update the feature state of the
    // previously hovered feature.
    mapGL.on('mouseleave', 'countries-fills', function () {
        if (hoveredStateId != null) {
            mapGL.setFeatureState({
                source: 'countries',
                id: hoveredStateId
            }, {
                hover: false
            });
        }
        hoveredStateId = null;

        mapGL.getCanvas().style.cursor = '';
        popup.remove();
    });

    mapGL.on('click', 'countries-fills', function (e) {
        if (e.features.length > 0) {
            handleSectionClick(e.features[0]);
        }
    });
}

function displayLayer(layerID, source, paint) {
    mapGL.addLayer({
        id: layerID,
        type: "fill",
        source: source,
        layout: {},
        paint: paint
    });
}

function getFeatureColorByIdentifier(identifier) {
    let returnVal = '#FFFFFF';
    let curData = getFeatureDataByIdentifier(identifier);

    if (curData != null && curData.color != null) {
        returnVal = curData.color;
    }

    return returnVal;
}

function getFeatureDataByIdentifier(identifier) {
    let returnVal = null;

    if (holdingWidget.queryResult.mapData != null &&
        holdingWidget.queryResult.mapData[identifier] != null &&
        holdingWidget.queryResult.mapData[identifier].length > 0 &&
        holdingWidget.queryResult.mapData[identifier][0].data != null) {
        returnVal = holdingWidget.queryResult.mapData[identifier][0].data;
    }

    return returnVal;
}

function getGeometryForFeatureIdentifier(identifier) {
    let returnVal;

    let source = mapGL.getSource('countries');
    let features;

    if (source != null &&
        source._data != null) {
        features = source._data.features;
    }

    if (features != null) {
        for (let index = 0; index < features.length; index++) {
            let curFeature = features[index];

            if (curFeature.properties.Identifier == identifier) {
                returnVal = curFeature.geometry;

                break;
            }
        }
    }

    return returnVal;
}

function zoomToFeature(target) {
    let curGeometry = getGeometryForFeatureIdentifier(target.properties.Identifier);

    if (curGeometry != null) {
        var coordinates = curGeometry.coordinates;

        let firstCord = curGeometry.coordinates;

        while (isNaN(firstCord[0])) {
            firstCord = firstCord[0];
        }

        var sw = new mapboxgl.LngLat(firstCord[0], firstCord[1]);
        var ne = new mapboxgl.LngLat(firstCord[0], firstCord[1]);
        var bounds = new mapboxgl.LngLatBounds(sw, ne);

        extendToBounds(bounds, coordinates);

        mapGL.fitBounds(bounds, {
            padding: 20
        });
    }
}

function extendToBounds(bounds, arrayToExtendTo) {
    arrayToExtendTo.forEach(curElm => {
        if (isNaN(curElm[0])) {
            extendToBounds(bounds, curElm)
        } else {
            bounds.extend(curElm);
        }
    });
}

function handleSectionClick(feature) {
    if (lastSelection != null) {
        if (lastSelection.id == feature.id) {
            lastSelection = null;
            clearSelection();

            mapGL.setBearing(0);

            mapGL.setPitch(0);

            mapGL.flyTo({
                center: [0, 0],
                zoom: 1
            });
        } else {
            lastSelection = null;

            setSectionSelection(feature);
        }
    } else {
        setSectionSelection(feature);
    }
}

function setSectionSelection(feature) {
    lastSelection = feature;
    zoomToFeature(lastSelection);

    clearSelection();

    setSelection(lastSelection);
}

function setSelection(feature) {
    var identifier = feature.properties.Identifier;

    if (identifier == "") {
        return;
    }

    let members = [identifier];

    var filterDimension = holdingWidget.metadata.panel("Identifier").items[0];

    let filter = {
        isCascading: false,
        disabled: false,
        jaql: {
            column: filterDimension.jaql.column,
            table: filterDimension.jaql.table,
            dim: filterDimension.jaql.dim,
            datatype: filterDimension.jaql.datatype,
            title: filterDimension.jaql.title,
            filter: {
                explicit: true,
                multiSelection: false
            }
        },
    };

    filter.jaql.filter.members = members;

    holdingWidget.dashboard.filters.update(filter, {
        save: true,
        refresh: true,
        unionIfSameDimensionAndSameType: false
    });
}

function clearSelection() {
    let dashFilters = holdingWidget.dashboard.filters.$$items;
    var filterDimension = holdingWidget.metadata.panel("Identifier").items[0];

    for (let filtersIndex = 0; filtersIndex < dashFilters.length; filtersIndex++) {
        if (dashFilters[filtersIndex].disabled == false) {
            if (filterDimension.jaql.dim == dashFilters[filtersIndex].jaql.dim &&
                dashFilters[filtersIndex].jaql.filter.all != true) {

                let filter = {
                    isCascading: false,
                    disabled: true,
                    jaql: {
                        column: filterDimension.jaql.column,
                        table: filterDimension.jaql.table,
                        dim: filterDimension.jaql.dim,
                        datatype: filterDimension.jaql.datatype,
                        title: filterDimension.jaql.title,
                        filter: {
                            explicit: true,
                            multiSelection: false
                        }
                    },
                };

                filter.jaql.filter.all = true;

                holdingWidget.dashboard.filters.update(filter, {
                    save: true,
                    refresh: true,
                    unionIfSameDimensionAndSameType: false
                });
            }
        }
    }
}