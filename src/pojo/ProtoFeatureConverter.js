/**
 * ProtoFeature bytes与Feature的相互转换
 * @author liuyu
 * @date 2022/10/31
 */
const ProtoFeature = require('./ProtoFeature_pb');


/**
 * ProtoFeature bytes 转 FeatureCollection
 * @param bytes           ProtoFeature bytes
 * @return FeatureCollection FeatureCollection geojson
 */
function proto2featureCollection(bytes) {
    const pFeatureCollection = ProtoFeature.FeatureCollection.deserializeBinary(bytes)
    const ctx = {
        keys: pFeatureCollection.getKeysList(),
        doubleValues: pFeatureCollection.getDoublevaluesList(),
        floatValues: pFeatureCollection.getFloatvaluesList(),
        sint32Values: pFeatureCollection.getSint32valuesList(),
        sint64Values: pFeatureCollection.getSint64valuesList(),
        stringValues: pFeatureCollection.getStringvaluesList(),
        bytesValues: pFeatureCollection.getBytesvaluesList()
    }
    const features = []
    const pPropertiess = pFeatureCollection.getPropertiessList()
    const pGeometries = pFeatureCollection.getGeometriesList()
    for (let i = 0; i < pPropertiess.length; i++) {
        const properties = parseMap(pPropertiess[i], ctx)
        const geometry = parseGeometry(pGeometries[i])
        features.push({
            type: 'Feature', properties: properties, geometry: geometry
        })
    }

    // pPropertiess.forEach(properties => {
    //     parseMap(properties, ctx)
    // })
    let headers = null;
    if (pFeatureCollection.hasHeaders()){
        headers = pFeatureCollection.getHeaders()
        headers = parseMap(headers, ctx)
    }

    const res = {
        type: 'FeatureCollection', features: features
    }
    if (headers) {
        res.headers = headers
    }

    return res;
}


function parseMap(pMap, ctx) {
    const map = {}

    putKeyValue(map, pMap.getDoublekeyidsList(), pMap.getDoublevalueidsList(), ctx.keys, ctx.doubleValues);
    putKeyValue(map, pMap.getFloatkeyidsList(), pMap.getFloatvalueidsList(), ctx.keys, ctx.floatValues);
    putKeyValue(map, pMap.getSint32keyidsList(), pMap.getSint32valueidsList(), ctx.keys, ctx.sint32Values);
    putKeyValue(map, pMap.getSint64keyidsList(), pMap.getSint64valueidsList(), ctx.keys, ctx.sint64Values);
    {
        // bool直接存值，单独处理
        const boolKeyIds = pMap.getBoolkeyidsList()
        const boolValues = pMap.getBoolvaluesList()
        for (let i = 0; i < boolKeyIds.length; i++) {
            const key = ctx.keys[boolKeyIds[i]];
            const value = boolValues[i];
            map[key] = value;
        }
    }
    putKeyValue(map, pMap.getStringkeyidsList(), pMap.getStringvalueidsList(), ctx.keys, ctx.stringValues);
    putKeyValue(map, pMap.getByteskeyidsList(), pMap.getBytesvalueidsList(), ctx.keys, ctx.bytesValues);

    {
        // list
        const listKeyIds = pMap.getListkeyidsList()
        const listValues = pMap.getListvaluesList()
        for (let i = 0; i < listKeyIds.length; i++) {
            const key = ctx.keys[listKeyIds[i]];
            const value = parseList(listValues[i], ctx);
            map[key] = value;
        }
    }

    {
        // map
        const subMapKeyIds = pMap.getSubmapkeyidsList()
        const subMapValues = pMap.getSubmapvaluesList()
        for (let i = 0; i < subMapKeyIds.length; i++) {
            const key = ctx.keys[subMapKeyIds[i]];
            const value = parseMap(subMapValues[i], ctx);
            map[key] = value;
        }
    }

    return map
}

function putKeyValue(map, keyIds, valueIds, keys, values) {
    for (let i = 0; i < keyIds.length; i++) {
        const keyId = keyIds[i];
        const valueId = valueIds[i];
        const key = keys[keyId];
        const value = values[valueId];
        map[key] = value;
    }
}


// List.indexes 标注list中的第n个元素的类型是什么类型，如[1L,2D,'SSS'] 的indexes为 [5,2,7]
const doubleValueIdsIndex = 2;
const floatValueIdsIndex = 3;
const sint32ValueIdsIndex = 4;
const sint64ValueIdsIndex = 5;
const boolValuesIndex = 6;
const stringValueIdsIndex = 7;
const bytesValueIdsIndex = 8;
const mapValuesIndex = 9;
const subListValuesIndex = 10;

function parseList(pList, ctx) {
    function ValueIdIterator(valueIds, values) {
        const iterator = valueIds.values()
        return {
            next: () => {
                const valueId = iterator.next().value
                return values[valueId]
            }
        }
    }

    function ValueIterator(values) {
        const iterator = values.values()
        return {
            next: () => {
                return iterator.next().value
            }
        }
    }

    function MapIterator(mapValues, ctx) {
        const iterator = mapValues.values()
        return {
            next: () => {
                const pMap = iterator.next().value
                const map = parseMap(pMap, ctx)
                return map
            }
        }
    }

    function ListIterator(subListValues, ctx) {
        const iterator = subListValues.values()
        return {
            next: () => {
                const pList = iterator.next().value
                const list = parseList(pList, ctx)
                return list
            }
        }
    }

    const iterators = {}
    iterators[doubleValueIdsIndex] = ValueIdIterator(pList.getDoublevalueidsList(), ctx.doubleValues)
    iterators[floatValueIdsIndex] = ValueIdIterator(pList.getFloatvalueidsList(), ctx.floatValues)
    iterators[sint32ValueIdsIndex] = ValueIdIterator(pList.getSint32valueidsList(), ctx.sint32Values)
    iterators[sint64ValueIdsIndex] = ValueIdIterator(pList.getSint64valueidsList(), ctx.sint64Values)
    iterators[stringValueIdsIndex] = ValueIdIterator(pList.getStringvalueidsList(), ctx.stringValues)
    iterators[bytesValueIdsIndex] = ValueIdIterator(pList.getBytesvalueidsList(), ctx.bytesValues)
    iterators[boolValuesIndex] = ValueIterator(pList.getBoolvaluesList())
    iterators[mapValuesIndex] = MapIterator(pList.getMapvaluesList(), ctx)
    iterators[subListValuesIndex] = ListIterator(pList.getSublistvaluesList(), ctx)

    const indexes = pList.getIndexesList()
    const list = []
    indexes.forEach(index => {
        const iterator = iterators[index]
        list.push(iterator.next())
    })
    return list
}

function parseGeometry(pGeometry) {
    let g
    g = pGeometry.getPoint()
    if (g) {
        return proto2Point(g)
    }
    g = pGeometry.getLinestring()
    if (g) {
        return proto2LineString(g)
    }
    g = pGeometry.getPolygon()
    if (g) {
        return proto2Polygon(g)
    }
    g = pGeometry.getMultipoint()
    if (g) {
        return proto2MultiPoint(g)
    }
    g = pGeometry.getMultilinestring()
    if (g) {
        return proto2MultiLineString(g)
    }
    g = pGeometry.getMultipolygon()
    if (g) {
        return proto2MultiPolygon(g)
    }
    g = pGeometry.getGeometrycollection()
    if (g) {
        return proto2GeometryCollection(g)
    }
    return null
}

function proto2Coordinates(xs, ys, zs) {
    const n = xs.length;
    const coordinates = new Array(n);
    if (zs.length === 0) {
        for (let i = 0; i < n; i++) {
            coordinates[i] = [xs[i], ys[i]];
        }
    } else {
        for (let i = 0; i < n; i++) {
            coordinates[i] = [xs[i], ys[i], zs[i]];
        }
    }
    return coordinates;
}


function coordinates2LinearRing(coordinates) {
    //coordinates的最后一个坐标被省略了，所以这里手工补上后才能转为环
    coordinates.push(coordinates[0])
    return coordinates
}

function proto2Point(g) {
    const coordinates = [g.getX(), g.getY()]
    const z = g.getZ()
    if (z) {
        coordinates.push(z)
    }
    return {
        "type": "Point", "coordinates": coordinates
    }
}

function proto2LineString(pLineString) {
    const coordinates = proto2Coordinates(pLineString.getXsList(), pLineString.getYsList(), pLineString.getZsList())
    return {
        "type": "LineString", "coordinates": coordinates
    };
}

function protoCoord2Polygon(separatorCoordinates) {
    const shell = coordinates2LinearRing(separatorCoordinates[0]);
    const holes = new Array(separatorCoordinates.length - 1);
    for (let i = 1; i < separatorCoordinates.length; i++) {
        holes[i - 1] = coordinates2LinearRing(separatorCoordinates[i]);
    }
    const allRing = []
    allRing.push(shell)
    holes.forEach(hole => {
        allRing.push(hole)
    })

    return {
        "type": "Polygon", "coordinates": allRing
    }
}

function proto2Polygon(pPolygon) {
    const coordinates = proto2Coordinates(pPolygon.getXsList(), pPolygon.getYsList(), pPolygon.getZsList());
    const separators = pPolygon.getSeparatorsList();
    if (separators.length == 0) {
        return {
            "type": "Polygon", "coordinates": [coordinates2LinearRing(coordinates)]
        };
    } else {
        return protoCoord2Polygon(separatorCoordinates(coordinates, separators));
    }
}

function proto2MultiPoint(pMultiPoint) {
    const coordinates = proto2Coordinates(pMultiPoint.getXsList(), pMultiPoint.getYsList(), pMultiPoint.getZsList());
    return {
        "type": "MultiPoint", "coordinates": coordinates
    };
}

function separatorCoordinates(coordinates, separators) {
    const separatorCoordinates = new Array(separators.length + 1);
    let idx = 0;
    let i = 0;
    let beforeSeparator = 0;
    for (let xx = 0; xx < separators.length; xx++) {
        let separator = separators[xx]
        separator = separator + 1;
        let k = 0;
        const subCoordinate = new Array(separator - beforeSeparator);
        for (; i < separator; i++) {
            subCoordinate[k] = coordinates[i];
            k++;
        }
        separatorCoordinates[idx] = subCoordinate;
        beforeSeparator = separator;
        idx++;
    }

    let k = 0;
    const subCoordinate = new Array(coordinates.length - i);
    for (; i < coordinates.length; i++) {
        subCoordinate[k] = coordinates[i];
        k++;
    }
    separatorCoordinates[idx] = subCoordinate;
    return separatorCoordinates;
}

function proto2MultiLineString(pMultiLineString) {
    const coordinates = proto2Coordinates(pMultiLineString.getXsList(), pMultiLineString.getYsList(), pMultiLineString.getZsList());
    const separators = pMultiLineString.getSeparatorsList();
    if (separators.length == 0) {
        return {
            "type": "MultiLineString", "coordinates": [coordinates]
        }
    } else {
        const _separatorCoordinates = separatorCoordinates(coordinates, separators);
        const lineStrings = new Array(_separatorCoordinates.length);
        for (let i = 0; i < lineStrings.length; i++) {
            lineStrings[i] = _separatorCoordinates[i];
        }
        return {
            "type": "MultiLineString", "coordinates": lineStrings
        };
    }
}

function proto2MultiPolygon(pMultiPolygon) {
    const coordinates = proto2Coordinates(pMultiPolygon.getXsList(), pMultiPolygon.getYsList(), pMultiPolygon.getZsList());
    let polygonSeparators = pMultiPolygon.getPolygonseparatorsList()

    const coordSeparators = pMultiPolygon.getCoordseparatorsList()
    if (polygonSeparators.length == 0) {
        return {
            "type": "MultiPolygon", "coordinates": [[coordinates2LinearRing(coordinates)]]
        }
    } else {
        const polygons = new Array(polygonSeparators.length + 1);
        let idx = 0;
        let beforePolygonSeparator = 0;
        const _separatorCoordinates = separatorCoordinates(coordinates, coordSeparators);
        polygonSeparators.push(_separatorCoordinates.length);
        for (let xx = 0; xx < polygonSeparators.length; xx++) {
            let polygonSeparator = polygonSeparators[xx]
            const subSeparatorCoordinates = new Array(polygonSeparator - beforePolygonSeparator);
            let i1 = 0;
            for (let i = beforePolygonSeparator; i < polygonSeparator; i++) {
                subSeparatorCoordinates[i1] = _separatorCoordinates[i];
                i1++;
            }
            const polygon = protoCoord2Polygon(subSeparatorCoordinates);
            polygons[idx] = polygon.coordinates;
            idx++;
            beforePolygonSeparator = polygonSeparator;
        }
        return {
            "type": "MultiPolygon", "coordinates": polygons
        };
    }
}

function proto2GeometryCollection(pGeometryCollection) {
    const geometryList = [];
    pGeometryCollection.getPointsList().forEach(point => {
        geometryList.push(proto2Point(point));
    })

    pGeometryCollection.getLinestringsList().forEach(lineString => {
        geometryList.push(proto2LineString(lineString));
    })

    pGeometryCollection.getPolygonsList().forEach(polygon => {
        geometryList.push(proto2Polygon(polygon));
    })

    pGeometryCollection.getMultipointsList().forEach(multiPoint => {
        geometryList.push(proto2MultiPoint(multiPoint));
    })
    pGeometryCollection.getMultilinestringsList().forEach(multiLineString => {
        geometryList.push(proto2MultiLineString(multiLineString));
    })

    pGeometryCollection.getMultipolygonsList().forEach(multiPolygon => {
        geometryList.push(proto2MultiPolygon(multiPolygon));
    })

    pGeometryCollection.getGeometrycollectionsList().forEach(geometryCollection => {
        geometryList.push(proto2GeometryCollection(geometryCollection));
    })
    return {
        "type": "GeometryCollection", "geometries": geometryList
    }
}

const ProtoFeatureConverter = {
    proto2featureCollection: proto2featureCollection
}

export {ProtoFeatureConverter}
