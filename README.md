# insert

```shell
npm i giscatjs
```

or

```html

<script src="../dist/giscat-js.js" type="text/javascript" charset="utf-8"></script>
```

# ProtoFeature bytes to geojson object

```js
function sendGet() {
    const req = new XMLHttpRequest();
    req.open("GET", "./data/testbytes.pbf", true);
    req.responseType = "arraybuffer";

    req.onload = () => {
        const arrayBuffer = req.response;
        if (arrayBuffer) {
            const bytes = new Uint8Array(arrayBuffer);// ProtoFeature bytes
            const fc = giscat.pojo.ProtoFeatureConverter.proto2featureCollection(bytes);
            console.log(fc) // obj
            console.log(JSON.stringify(fc)) // string
        }
    };
    req.send();
}

sendGet()
```
