var map = M.getMap();

var layersCache = {}, // 统计专题图层缓存
  initZoom = map.getZoom(),
  stateGb = "156000000", // 初始中国的GBCODE
  provinceGb, // 省的GBCODE
  cityGb, // 市的GBCODE
  checkedNodes, // 所选择的统计数据专题节点
  curNode, // 当前选择的节点
  requestDatasFunc, // 请求数据的函数
  regionsCache = {}, // 行政区化矢量数据缓存
  layerInfos = {}, // 城市名称与行政区划编码对应表
  graphicInfos = {}, // 统计图与行政区域的
  resultStore,
  hightlightStore,
  first,
  listDates,
  styleFlg = false,
  zoomBefore,
  zoomAfter,
  gbborder,
  shxborder;

// 新疆regions
var xjRegions = {
  type: "Feature",
  features: [
    {
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates: [
          [74.81028, 37.2168],
          [75.12717, 37.33573],
          [75.10042, 37.48624],
          [74.877, 37.59328],
          [74.917, 38.02561],
          [74.81694, 38.09791],
          [74.79043, 38.27102],
          [74.86435, 38.47251],
          [74.63552, 38.59519],
          [74.39928, 38.66063],
          [74.12309, 38.66326],
          [74.04128, 38.54366],
        ],
      },
    },
  ],
};

// 色系未定
var colors = {
  staticDefault: [
    "#44b9b0",
    "#e65414",
    "#d1c87f",
    "#7c37c0",
    "#cc9fb1",
    "#248838",
  ],
  default: [
    "#FFFF00",
    "#FFE100",
    "#FFC300",
    "#FFA600",
    "#FF8800",
    "#FF7500",
    "#FF6600",
  ],
  1: [
    "#ffff4c",
    "#ffeb4c",
    "#ffd84c",
    "#ffc44c",
    "#ffb04c",
    "#ff9d4c",
    "#ff894c",
    "#ff754c",
    "#ff624c",
  ],
  2: [
    "#4daa4b",
    "#90c469",
    "#daca61",
    "#e4a14b",
    "#e98125",
    "#2484c1",
    "#0c6197",
  ],
};
// 符号大小集合
var radiuses = {
  default: [4, 6, 8, 10, 12, 14, 16],
  default_map_radius: [8, 15, 22, 29, 36, 43, 50],
};
var treeData, repeatParam, gbGeoJson, xjGeojson, shxGeoJson;
var shapeRecords = {},
  opacityStore = {}; // 分级设色专题图形状记录器{'26':{type:'polygon|symbol',size:100,shape:'rectang'|'circle',num:7}}
var timer = null,
  parts;

/**
 * 加载专题图层
 * @param callback 		  专题数据获取函数
 * @param callbackParams  callback所需要的回传参数
 */
function loadMapLayers(
  callback,
  callbackParams,
  datesCache,
  hightLightObj,
  repeatTable
) {
  // 存储请求统计数据的方法
  requestDatasFunc = callback;
  // 所有已经选择的统计数据节点
  curNode = callbackParams.cur;
  checkedNodes = callbackParams.chk;
  treeData = callbackParams.treeData;
  // 时间列表缓存
  listDates = datesCache;
  // 存储高亮统计表格的方法
  hightlightStore = hightLightObj;
  repeatParam = repeatTable;
  // 重新绘制所有统计数据的专题图
  redrawStaticLayers();
  // 事件注册
  eventRegister();
}

/**
 * 事件注册
 */
function eventRegister() {
  // 点击地图绘制专题图
  map.off("click", mapClickFunc).on("click", mapClickFunc);
  // 地图级别发生变化事件
  map.off("zoomstart", mapZoomStartFunc).on("zoomstart", mapZoomStartFunc);
  map.off("zoomend", mapZoomEndFunc).on("zoomend", mapZoomEndFunc);
}

/**
 * 地图点击事件
 */
function mapClickFunc(evt) {
  clearTimeout(timer);
  timer = setTimeout(function () {
    var zoom = map.getZoom();
    var latlng = evt.latlng;
    var postData = { lng: latlng.lng, lat: latlng.lat, level: zoom };
    $.ajax({
      url: "./zhfw/gbcode",
      data: JSON.stringify(postData),
      dataType: "json",
      contentType: "application/json",
      type: "POST",
      success: function (result) {
        var gbcode = result.parentGbcode;
        // 全球数据除外
        if (gbcode == "000000000") {
          return;
        }

        //	var center = L.latLng(Number(result.lnglat.split(' ')[1]), Number(result.lnglat.split(' ')[0]));
        //	map.setView(center);
        redrawStaticLayers(gbcode);
      },
      error: function () {
        throw "根据经纬度获取gbcode失败";
      },
    });
  }, 300);
}

/**
 * 地图级别变化前
 */
function mapZoomStartFunc(evt) {
  zoomBefore = map.getZoom();
  $("#app").children(".property_popup").remove();
}

/**
 * 地图级别变化后
 */
function mapZoomEndFunc() {
  zoomAfter = map.getZoom();
  if (zoomAfter > 6) {
    // 存在国界删除国界
    clearGbGeojson();
  }
  // 地图缩小情况,需要重新绘制统计专题
  if (zoomAfter < zoomBefore) {
    // 由市级缩成省级
    if (
      zoomBefore >= 7 &&
      zoomBefore <= 8 &&
      zoomAfter >= 4 &&
      zoomAfter <= 6
    ) {
      provinceGb = undefined;
      redrawStaticLayers("156000000");
    }
    // 由县级缩成市级
    if (
      zoomBefore >= 9 &&
      zoomBefore <= 11 &&
      zoomAfter >= 7 &&
      zoomAfter <= 8
    ) {
      if (!provinceGb) {
        return;
      }
      cityGb = undefined;
      redrawStaticLayers(provinceGb);
    }
    // 由镇级缩成县级
    if (zoomBefore > 11 && zoomAfter >= 9 && zoomAfter <= 11) {
      if (!cityGb) {
        return;
      }
      redrawStaticLayers(cityGb);
    }
    // 地图放大的情况
  } else {
    // 由省级放大到市级,由市级放大到县级
    if (
      zoomBefore >= 4 &&
      zoomBefore <= 6 &&
      zoomAfter >= 7 &&
      zoomAfter <= 8
    ) {
      if (provinceGb) {
        return;
      }
      clearSubjectInfo();
    } else if (
      zoomBefore >= 7 &&
      zoomBefore <= 8 &&
      zoomAfter >= 9 &&
      zoomAfter <= 11
    ) {
      if (cityGb) {
        return;
      }
      clearShxborder();
      clearSubjectInfo();
    } else if (zoomAfter > 11) {
      clearShxborder();
      clearSubjectInfo();
    }
  }
}

/**
 * 清除专题信息
 */
function clearSubjectInfo() {
  for (var code in layersCache) {
    map.removeLayer(layersCache[code]);
    delete layersCache[code];
    // 清除图例
    $("#subject_" + code)
      .find(".lv2-info")
      .html("");
  }
  $(".main_table").hide();
  $(".main_graphic").hide();
  TA.removeSkate();
}

/**
 * 重新绘制所选择的专题图层
 * 该处需要根据专题的类型做判断，分级设色，饼图
 * @param gbcode 行政区code,行政区发生变化，专题图重绘
 * @param style  true|false,专题图样式发生变化，专题图重绘
 */
function redrawStaticLayers(gbcode, style) {
  // 第一次加载专题图的标识
  first = false;
  // 获取当前用户选择的行政区的GBCODE
  if (!gbcode) {
    gbcode = getGbcode();
  } else {
    // 依靠级别设置gbcode
    setGbcodeByZoom(gbcode);
    repeatParam[curNode.code] = false;
  }
  // 缓存中是否已经存在该行政区对应的子行政区，没有的话去服务器请求
  if (!regionsCache[gbcode]) {
    //根据GBCODE请求子行政区划数据
    var postData = { gbcode: gbcode, type: "s" };
    $.ajax({
      url: "./zhfw/border",
      data: JSON.stringify(postData),
      dataType: "json",
      contentType: "application/json",
      type: "POST",
      success: function (result) {
        var regions = JSON.parse(result.geodata);
        for (var f in regions.features) {
          regions.features[f] = L.GeoJSON.Encoded.prototype._decodeFeature(
            regions.features[f]
          );
        }

        regionsCache[gbcode] = regions;
        requestData(gbcode, regions, "s");
      },
      error: function () {
        throw "根据gbcode获取行政区域数据失败";
      },
    });
  } else {
    requestData(gbcode, regionsCache[gbcode], "s");
  }
}

/**
 * 添加地图图层
 * @param gbcode  行政区划code
 * @param regions 行政区划信息
 * @param level   s:代表由父GBCODE找子GBCODE, m:代表查找同级GBCODE, p:代表查找父级并且与之同级的GBCODE 边界信息
 * @param style   样式引起的重绘标识
 */
function requestData(gbcode, regions, level) {
  resultStore = {};
  // 叠加当前选择的所有统计数据专题图
  for (var j in checkedNodes) {
    var cur = checkedNodes[j];
    // 添加额外的查询条件：1、行政区划code; 2、时间年份; 3、列类型：pro->地图属性框中的属性标志，col->表格中的属性标志，
    cur.gbcode = gbcode;
    // 级别
    cur.type = level;
    // 年份
    // 统计表引起的查询
    if (curNode.year) {
      cur.year = curNode.year;
    } else {
      cur.year = listDates[cur.code][0].year;
    }
    // 回调获取当前行政区的专题数据
    requestDatasFunc(cur, successFunc(regions, cur), errorFunc);
  }
}

/**
 * 加载地图数据成功
 * @param result 成功返回的数据集
 */
function successFunc(regions, cur) {
  graphicInfos = regions;
  // 加载地图数据成功的函数
  return function (result) {
    resultStore[cur.code] = result;
    var len = objLength(resultStore);
    // 所有的统计数据还没有请求完
    if (len != checkedNodes.length) {
      return;
    }
    if (!first) {
      addLayers(regions, cur.gbcode);
      first = true;
    }
  };
}

function addLayers(regions, gbcode) {
  // 删除之前所有的统计数据专题图
  for (var code in layersCache) {
    map.removeLayer(layersCache[code]);
    delete layersCache[code];
  }
  // 存在国界删除国界
  clearGbGeojson();
  // 从后向前叠加图层，该地方需要根据不同的专题，绘制不同的专题：饼图，分级设色图
  for (var i = checkedNodes.length - 1; i >= 0; i--) {
    parts = [];
    var current = checkedNodes[i];
    var result = resultStore[current.code];
    var continueFlg = false;
    // 没有专题数据的图层不叠加
    for (var r in result) {
      if (r.indexOf(current.code) > -1) {
        for (var d = 0; d < result[r].datas.length; d++) {
          var data = result[r].datas[d];
          if (objLength(data) == 3) {
            result[r].datas.splice(d, 1);
            d = -1;
          }
        }
        if (result[r].datas.length == 0) {
          continueFlg = true;
        }
        break;
      }
    }
    if (continueFlg) {
      // 清除图例
      $("#subject_" + current.code)
        .find(".lv2-info")
        .html("");
      continue;
    }
    var opacity = opacityStore[code] || 0.7;
    // 绘制分级设色图
    if (current.layerType == "1" || current.layerType == "3") {
      var code = current.code;
      // 该专题被设置过样式
      if (shapeRecords[code]) {
        // 分级设色
        if (shapeRecords[code].type == "polygon") {
          polygonHander(current, regions, gbcode);
          // 符号
        } else if (shapeRecords[code].type == "symbol") {
          drawSymbol(current, regions, gbcode);
        }
      } else {
        // 默认分级设色
        if (current.layerType == "1") {
          var obj = { type: "polygon", opacity: opacity };
          shapeRecords[code] = obj;
          polygonHander(current, regions, gbcode);
          // 默认圆形符号
        } else if (current.layerType == "3") {
          var obj = {
            type: "symbol",
            opacity: opacity,
            shape: "circle",
            color: "#0000FF",
          };
          shapeRecords[code] = obj;
          drawSymbol(current, regions, gbcode);
        }
      }
      // 绘制饼图
    } else if (current.layerType == "2" || current.layerType == "4") {
      // 饼图
      if (current.layerType == "2") {
        staticGraphicHander(current, regions, gbcode, "pie");
        // 条形图
      } else if (current.layerType == "4") {
        staticGraphicHander(current, regions, gbcode, "column");
      }
    }
  }
  // 设置图层的叠加顺序
  resetLayersZIndex();

  if (gbGeoJson && xjGeojson) {
    gbGeoJson.bringToFront();
    xjGeojson.bringToFront();
  }
}

/**
 * 绘制圆形符号图
 */
function drawSymbol(current, regions, gbcode) {
  clearShxborder();
  var code = current.code;
  var result = resultStore[code];
  var state = getState(result, code);
  var features = regions.features;
  var shape = shapeRecords[code].shape;
  var opacity = opacityStore[code] || 0.7;
  var color = shapeRecords[code].color;
  var shapeLayers = [];
  for (var i in features) {
    var properties = features[i].properties;
    var gb = "156" + properties["GB"];
    var cname = properties["CNAME"];
    var lng = properties["lng"];
    var lat = properties["lat"];
    var rad = getRadius(state, gb);
    if (rad == 0) {
      continue;
    }
    var shapeLayer; // 形状图层
    var latlng = L.latLng(lat, lng);
    shapeLayer = new MyCustomLayer(latlng, "", shape, code, {
      radius: rad / 2,
      fillOpacity: opacity,
      fillColor: color,
      latlng: latlng,
      cname: cname,
      gbcode: gb,
    });
    shapeLayers.push(shapeLayer);
  }
  var layerGroup = L.layerGroup(shapeLayers);
  layersCache[code] = layerGroup;
  // 添加图例
  addSymbolLegend(code, state, shape, color);
  // 绘制国界,国界不存在的时候才绘制国界
  if (gbcode != "156000000" && !shxborder) {
    shxborder = true;
    drawBorders(gbcode);
  }
}

function clearShxborder() {
  if (shxGeoJson) {
    map.removeLayer(shxGeoJson);
    shxGeoJson = null;
    shxborder = false;
  }
}

/**
 * 符号图的图例
 */
function addSymbolLegend(code, state, shape, color) {
  var num = 7;
  if (radiuses[state.code]) {
    num = radiuses[state.code].length;
  }
  var parts = getLengendParts(state.datas, num);
  var len = parts.length;
  var legendTexts = [],
    text,
    maxRadius;
  maxRadius = radiuses["default"][len - 1];
  for (var p in parts) {
    var part = parts[p];
    if (!part.min && !part.max) {
      continue;
    }
    if (!part.max && part.min) {
      text = " >= " + part.min;
    } else if (!part.min && part.max) {
      text = " < " + part.max;
    } else if (part.min && part.max) {
      text = part.min + " - " + part.max;
    }
    var legend = {};
    legend.text = text;
    var radius = maxRadius - (len - p - 1) * 2;
    if (shape == "circle") {
      legend.radius = radius + "px";
    }
    legend.width = legend.height = radius + "px";
    legend.color = color;
    legend.lineHeight = maxRadius + "px";
    legend.marginTop = legend.marginLeft = (maxRadius - radius) / 2 + "px";
    legendTexts.push(legend);
  }
  LG.addLegend(code, legendTexts);
}
/**
 * 分级设色专题图的处理
 * @param current 需要处理的专题节点
 */

var activeGB = 0;

function polygonHander(current, regions, gbcode) {
  // 县级不需要绘制区划
  if (gbcode.substr(-4) !== "0000") {
    return;
  }

  clearShxborder();
  var code = current.code;
  var result = resultStore[code];
  var state = getState(result, code); // 获取图例的最大值，以及该专题所对应的所有值列表的状态
  var opacity = opacityStore[code] || 0.7;
  var geoJson = L.geoJson(regions, {
    style: function (feature) {
      var gb = "156" + feature.properties["GB"];
      var color = getColor(state, gb);
      return {
        weight: 2,
        fillOpacity: opacity,
        color: "#ffffff",
        fillColor: color,
      };
    },
    onEachFeature: function (feature, layer) {
      // 当前feature的行政区划code
      var gb = "156" + feature.properties["GB"];
      var cname = feature.properties["CNAME"];
      var lat = feature.properties["lat"];
      var lng = feature.properties["lng"];
      layerInfos[gb] = layer;

      // 求当前行政区划上所有统计图层所具有的属性，并绑定到feature上
      layer.on("mousemove", function (evt) {
        var left = evt.originalEvent.pageX + 25 + "px";
        var top = evt.originalEvent.pageY + "px";
        $("#app").children(".property_popup").css({ left: left, top: top });
      });
      // 鼠标离开行政区
      layer.on("mouseout", function () {
        layerInfos[gb].hasBold = false;
        this.setStyle({ dashArray: "0", weight: 2, color: "#ffffff" });
        if (gbGeoJson && xjGeojson) {
          gbGeoJson.bringToFront();
          xjGeojson.bringToFront();
        }
        $("#app").children(".property_popup").remove();
        // 与统计表格和统计图联动
        hightlightStore.paramCancelHighlight("map");
        activeGB = 0;
      });
      // 鼠标离开行政区
      layer.on("mouseover", function () {
        if (activeGB != gb) {
          //解决ie点击bug
          activeGB = gb;
          for (var key in layerInfos) {
            if (layerInfos[key].hasBold) {
              layerInfos[key].setStyle({
                dashArray: "0",
                weight: 2,
                color: "#ffffff",
              });
              layerInfos[key].hasBold = false;
            }
          }
          layerInfos[gb].hasBold = true;
          this.setStyle({ dashArray: "0", weight: 5, color: "#0002fb" });
          this.bringToFront();
          // 获取所有统计图层的属性
          propertiesBox(cname, gb);
          // 与统计表格联动
          hightlightStore.paramHighlight(gb, "map");
        }
      });
      map.on("mouseover", function () {
        for (var key in layerInfos) {
          if (layerInfos[key].hasBold) {
            layerInfos[key].setStyle({
              dashArray: "0",
              weight: 2,
              color: "#ffffff",
            });
            layerInfos[key].hasBold = false;
          }
        }
        activeGB = 0;
      });
      // 鼠标双击行政区，开始绘制下一级别行政区
      layer.on({
        dblclick: function (evt) {
          if (gb.substr(-2) != "00") {
            return;
          }
          // 中心点经纬度
          var latlng = L.latLng(lat, lng);
          var zoom = getZoomByGbcode(gb);
          map.setView(latlng, zoom); // 设置地图中心点为选中的行政区
          redrawStaticLayers(gb);
        },
      });
    },
  });
  // 图层缓存
  layersCache[code] = L.layerGroup([geoJson]);
  // 添加图例
  addPolygonLegend(code, state);

  // 绘制国界,国界不存在的时候才绘制国界
  if (gbcode == "156000000" && !gbborder) {
    gbborder = true;
    var postData = { gbcode: gbcode };
    $.ajax({
      url: "./zhfw/gborder",
      data: JSON.stringify(postData),
      dataType: "json",
      contentType: "application/json",
      type: "POST",
      success: function (result) {
        if (checkedNodes.length == 0) {
          gbborder = false;
          return;
        }
        var regions = JSON.parse(result.geodata);
        for (var f in regions.features) {
          regions.features[f] = L.GeoJSON.Encoded.prototype._decodeFeature(
            regions.features[f]
          );
        }
        // 国界
        gbGeoJson = L.geoJson(regions, {
          style: function (feature) {
            return {
              weight: 3,
              fillOpacity: 0,
              color: "red",
            };
          },
        });
        map.addLayer(gbGeoJson);
        // 新疆边界
        xjGeojson = L.geoJson(xjRegions, {
          style: function (feature) {
            return {
              weight: 3,
              opacity: 1,
              color: "#ecece8",
              dashArray: 15,
            };
          },
        });
        map.addLayer(xjGeojson);
      },
      error: function () {
        throw "根据gbcode获取行政区域数据失败";
      },
    });
  }
}

/**
 * 绘制行政区划边界
 * @param gbcode 行政区划代码
 */
function drawBorders(gbcode) {
  var postData = { gbcode: gbcode };
  $.ajax({
    url: "./zhfw/border",
    data: JSON.stringify(postData),
    dataType: "json",
    contentType: "application/json",
    type: "POST",
    success: function (result) {
      if (checkedNodes.length == 0) {
        shxborder = false;
        return;
      }
      var regions = JSON.parse(result.geodata);
      for (var f in regions.features) {
        regions.features[f] = L.GeoJSON.Encoded.prototype._decodeFeature(
          regions.features[f]
        );
      }
      // 国界
      shxGeoJson = L.geoJson(regions, {
        style: function (feature) {
          return {
            weight: 3,
            fillOpacity: 0,
            color: "red",
          };
        },
      });
      map.addLayer(shxGeoJson);
      shxGeoJson.bringToBack();
    },
    error: function () {
      throw "根据gbcode获取行政区域数据失败";
    },
  });
}

/**
 * 饼图，条形图的专题处理
 * @param current 需要绘制饼图的专题节点
 * @param regions 行政区域数据
 * @param gbcode  当前的专题图的父级
 * @param gcType  图标的类型，pie：饼图，column:条形图
 */
function staticGraphicHander(current, regions, gbcode, gcType) {
  clearShxborder();
  var code = current.code;
  var dataset = getStaticDataSet(code, regions, gbcode);
  var graphicLayers = [];
  for (var idx in dataset) {
    var data = dataset[idx];
    if (data.datas.length == 0) continue;
    var layer = new MyCustomLayer(
      L.latLng(data.lat, data.lng),
      data.datas,
      gcType,
      code
    );
    graphicLayers.push(layer);
  }
  var layerGroup = L.layerGroup(graphicLayers);
  layersCache[code] = layerGroup;
  // 添加统计图的图例
  if (dataset.length > 0) {
    for (var i = 0; i < dataset.length; i++) {
      if (dataset[i].datas.length > 0) {
        addGraphicLegend(code, dataset[i].datas);
        break;
      }
    }
  }

  // 绘制国界,国界不存在的时候才绘制国界
  if (gbcode != "156000000" && !shxborder) {
    shxborder = true;
    drawBorders(gbcode);
  }
}

/**
 * 获取统计图所需要的数据集
 */
function getStaticDataSet(code, regions, gbcode) {
  var result = resultStore[code];
  if (!result) {
    return [];
  }
  var features = regions.features;
  var dataset = [];
  for (var i in features) {
    var properties = features[i].properties;
    var gbcode = "156" + properties["GB"];
    var lng = properties["lng"];
    var lat = properties["lat"];
    var datas = [];
    var res;
    for (var r in result) {
      if (r.indexOf(code) == 0) res = result[r];
    }
    var resDatas = res.datas;
    var resEns = res.headens.split(",");
    var resCns = res.heads;
    for (var j in resDatas) {
      if (gbcode == resDatas[j]["gbcode"]) {
        for (var k = 2; k < resEns.length - 1; k++) {
          var obj = {};
          obj.cityname = resDatas[j]["cityname"];
          obj.label = resCns[k];
          obj.value = resDatas[j][resEns[k]];
          if (colors[code]) {
            obj.color = colors[code][k - 2];
          } else {
            obj.color = colors["staticDefault"][k - 2];
          }
          obj.gbcode = gbcode;
          datas.push(obj);
        }
        break;
      }
    }
    var data = { lat: lat, lng: lng, datas: datas };
    dataset.push(data);
  }

  return dataset;
}

/**
 * TODO：遍历过多需要优化
 * 查询给定行政区上的所有统计图层的属性，弹出属性框进行显示
 * @param gbcode 行政区划code
 */
function getProperties(gbcode) {
  var properties = [];
  for (var idx in checkedNodes) {
    var cur = checkedNodes[idx];
    var code = cur.code;
    var res = resultStore[code];
    for (var r in res) {
      // 以code开头的key
      if (r.indexOf(code) == 0) {
        var datas = res[r].datas;
        var ens = res[r].headens.split(",");
        var cns = res[r].heads;
        for (var j in datas) {
          // 找到该行政区
          if (datas[j].gbcode == gbcode) {
            for (var k = 2; k < ens.length - 1; k++) {
              var prop = {};
              prop["title"] = ens[k] != "value" ? cns[k] : cur.name;
              prop["info"] = datas[j][ens[k]] ? datas[j][ens[k]] : "暂无";
              properties.push(prop);
            }
            break;
          }
        }
        // 遍历寻找数据
        break;
      }
    }
  }
  // 调用属性框的接口，弹出属性框展示图层的属性信息
  return properties;
}

/**
 * 获取各个专题的图层状态
 * @param  code  	专题code
 * @param  gbcode   行政区code
 * @return 返回该行政区
 */
function getState(result, code) {
  var values = {},
    datasList = [];
  var res;
  for (var r in result) {
    if (r.indexOf(code) == 0) res = result[r];
  }
  var datas = res.datas;
  var ens = res.headens.split(",");
  for (var j in datas) {
    var data = datas[j][ens[2]];
    values[datas[j].gbcode] = data;
    datasList.push(data);
  }

  return { values: values, code: code, datas: datasList };
}

/**
 * 获取当前行政区划符号的大小
 */
function getRadius(state, gbcode) {
  var num = 7;
  if (radiuses[state.code]) {
    num = radiuses[state.code].length;
  }
  var parts = getLengendParts(state.datas, num); // TODO：不同的专题需要设置不同的间隔
  var value = state.values[gbcode];
  if (!value) {
    return 0; // 值不存在，符号半径为0
  }
  for (var p in parts) {
    var part = parts[p];
    if (
      (!part.min && value < part.max) ||
      (value >= part.min && value < part.max) ||
      (!part.max && value >= part.min)
    ) {
      if (radiuses[state.code]) {
        return radiuses[state.code][p];
      } else {
        return radiuses["default_map_radius"][p];
      }
    }
  }
}

/**
 * 获取当前行政区划的颜色值
 * @param state 当前行政区所处的状态
 */
function getColor(state, gbcode) {
  var num = 7;
  if (colors[state.code]) {
    num = colors[state.code].length;
  }
  var parts = getLengendParts(state.datas, num); // TODO：不同的专题需要设置不同的间隔
  var value = state.values[gbcode];
  if (!value) {
    return "#FFFFFF"; // 值不存在返回白色
  }
  for (var p in parts) {
    var part = parts[p];
    if (!part.min && !part.max) {
      continue;
    }
    if (
      (!part.min && value < part.max) ||
      (value >= part.min && value < part.max) ||
      (!part.max && value >= part.min)
    ) {
      if (colors[state.code]) {
        return colors[state.code][p].hsl;
      } else {
        return colors["default"][p];
      }
    }
  }
}

/**
 * 根据gbcode获取它应该缩放的级别
 */
function getZoomByGbcode(gbcode) {
  var zoom;
  // 国家级别
  if (gbcode == "156000000") {
    zoom = "4";
    // 省级别
  } else if (gbcode.substr(-4) == "0000") {
    zoom = "7";
    // 市级别
  } else if (gbcode.substr(-2) == "00") {
    zoom = "9";
  }
  return zoom;
}

/**
 * 根据级别和gbcode存储各个级别的gbcode
 */
function setGbcodeByZoom(gbcode) {
  var zoom = map._animateToZoom;
  if (zoom >= 4 && zoom <= 6) {
    stateGb = "156000000";
    provinceGb = cityGb = undefined;
  } else if (zoom >= 7 && zoom <= 8) {
    provinceGb = gbcode == "156000000" ? undefined : gbcode;
    cityGb = undefined;
  } else if (zoom >= 9 && zoom <= 11) {
    cityGb = gbcode == "156000000" ? undefined : gbcode;
  }
}

/**
 * 根据区间的个数获取图例的区间
 * @param datas  数据集合
 * @param n      数据区间个数
 */
function getLengendParts(dataLists, n) {
  if (parts.length > 0) {
    return parts;
  }
  n = n - 1;
  var mat1 = [],
    mat2 = [],
    tempMat1,
    tempMat2;
  // 数据集排序：升序
  dataLists.sort(function (a, b) {
    return a - b;
  });
  var len = dataLists.length;
  for (var r = 0; r <= len; r++) {
    (tempMat1 = []), (tempMat2 = []);
    for (var c = 0; c <= n; c++) {
      tempMat1.push(0);
      tempMat2.push(0);
    }
    mat1.push(tempMat1);
    mat2.push(tempMat2);
  }

  for (var i = 1; i <= n; i++) {
    mat1[1][i] = 1;
    mat2[1][i] = 0;
    for (var j = 2; j <= len; j++) {
      mat2[j][i] = 99999999999999999;
    }
  }

  var ssd = 0;
  for (var rangeEnd = 2; rangeEnd <= len; rangeEnd++) {
    var sumX = 0,
      sumX2 = 0,
      w = 0,
      dataId;
    for (var m = 1; m <= rangeEnd; m++) {
      dataId = rangeEnd - m + 1;
      val = dataLists[dataId - 1];
      sumX2 += val * val;
      sumX += val;
      w++;
      ssd = sumX2 - (sumX * sumX) / w;
      for (var j = 2; j <= n; j++) {
        if (!(mat2[rangeEnd][j] < ssd + mat2[dataId - 1][j - 1])) {
          mat1[rangeEnd][j] = dataId;
          mat2[rangeEnd][j] = ssd + mat2[dataId - 1][j - 1];
        }
      }
    }
    mat1[rangeEnd][1] = 1;
    mat2[rangeEnd][1] = ssd;
  }

  var pResult = [];
  for (var i = 0; i < n; i++) {
    pResult.push(0);
  }
  pResult[n - 1] = dataLists[len - 1];

  var k = len;
  for (var j = n; j >= 2; j--) {
    var id = parseInt(mat1[k][j]) - 2;
    pResult[j - 2] = dataLists[id];
    k = parseInt(mat1[k][j]) - 1;
  }

  for (var i = 0; i < pResult.length; i++) {
    var part = {};
    if (i == 0) {
      part.min = null;
      part.max = pResult[i];
    } else {
      part.min = pResult[i - 1];
      part.max = pResult[i];
    }
    parts.push(part);
  }

  parts.push({ min: pResult[pResult.length - 1], max: null });
  return parts;
}

/**
 * 没有四舍五入的小数点保留
 * @param number 需要处理的数值
 * @param n      需要保留的小数点
 * @return 返回处理之后的结果
 */
function toFixedNoRound(number, n) {
  return number.toFixed(n + 1).substr(0, number.toFixed(n + 1).length - 1);
}

/**
 * 添加面的图例
 */
function addPolygonLegend(code, state) {
  var num = 7;
  if (colors[state.code]) {
    num = colors[state.code].length;
  }
  var parts = getLengendParts(state.datas, num);
  var legendTexts = [],
    text;
  for (var p in parts) {
    var part = parts[p];
    if (!part.min && !part.max) {
      continue;
    }
    if (!part.max && part.min) {
      text = " >= " + part.min;
    } else if (!part.min && part.max) {
      text = " < " + part.max;
    } else if (part.min && part.max) {
      text = part.min + " - " + part.max;
    }
    var legend = {};
    legend.text = text;
    if (colors[state.code]) {
      legend.color = colors[state.code][p].hsl;
    } else {
      legend.color = colors["default"][p];
    }
    legendTexts.push(legend);
  }
  LG.addLegend(code, legendTexts);
}

/**
 * 添加饼图的图例
 */
function addGraphicLegend(code, state) {
  var legendTexts = [];
  for (var s = 0; s < state.length; s++) {
    var legend = {};
    legend.text = state[s].label;
    if (colors[code]) {
      legend.color = colors[code][s].hsl;
    } else {
      legend.color = colors["staticDefault"][s];
    }
    legendTexts.push(legend);
  }
  LG.addLegend(code, legendTexts);
}

/**
 * 计算对象的长度
 */
function objLength(obj) {
  if (typeof obj == "object") {
    var n = 0;
    for (var i in obj) {
      n++;
    }
    return n;
  }
}

/**
 * 清空某个图层
 */
function clearLayer(current, checkedDatas) {
  var code = current.code;
  checkedNodes = checkedDatas;
  // 清除图层
  if (layersCache[code]) {
    map.removeLayer(layersCache[code]);
    delete layersCache[code];
  }

  // 清除图例
  $("#subject_" + code)
    .find(".lv2-info")
    .html("");
  if (checkedDatas.length == 0) {
    // 清除行政区划缓存
    provinceGb = cityGb = undefined;
    // 清除地图点击事件
    map.off("click", mapClickFunc);
    // 地图级别发生变化事件
    map.off("zoomstart", mapZoomStartFunc);
    map.off("zoomend", mapZoomEndFunc);
  }

  $("#app").children(".property_popup").remove();
  // 清除国界
  clearGbGeojson();
  // 清除省市边界
  clearShxborder();
}

/**
 * 清除国界
 */
function clearGbGeojson() {
  // 存在国界删除国界
  if (gbGeoJson) {
    console.log(TA.getState());
    // 播放过程不清除国界
    if (TA.getState() == "play") {
      gbGeoJson.bringToFront();
      xjGeojson.bringToFront();
      return;
    }
    map.removeLayer(gbGeoJson);
    map.removeLayer(xjGeojson);
    xjGeojson = gbGeoJson = null;
    gbborder = false;
  }
}

/**
 * 获取用户选中的行政区划GBCODE，没有选中的默认为中国
 */
function getGbcode() {
  var level = 4;
  var zoom = map.getZoom();

  //   var clickTa = TA.getClickTa(); //XXX 时间轴触发状态
  //设置时间轴触发的状态为false;
  //   TA.setClickTa(); XXX

  // 以省为单位进行绘制专题图
  if (zoom >= 4 && zoom <= 6) {
    // if (!clickTa) {
    //   map.setView(L.latLng(36, 105), 4);
    // }
    return stateGb;
    // 以市为单元进行绘制
  } else if (zoom >= 7 && zoom <= 8) {
    // 市的级别，没有选中市，则默认到省单位：先放大到市再选择专题的情况
    if (!provinceGb) {
      //   if (!clickTa) {
      //     map.setView(L.latLng(36, 105), 4);
      //   }
      return stateGb;
    }
    map.setZoom(7);
    return provinceGb;
    // 以区县为单元进行绘制
  } else if (zoom >= 9 && zoom <= 11) {
    // 县的级别，没有选中县，则默认到省单位：先放大到县再选择专题的情况
    if (!cityGb) {
      //   if (!clickTa) {
      //     map.setView(L.latLng(36, 105), 4);
      //   }
      return stateGb;
    }
    // 先定位到县级别
    map.setZoom(9);
    return cityGb;
  } else {
    map.setView(L.latLng(36, 105), 4);
    return stateGb;
  }
}

/**
 * 绘制饼图
 */
function drawPieCharts(el, param, dataset, code) {
  var options = {
    size: {
      canvasHeight: param.height * 2,
      canvasWidth: param.width * 2,
      pieInnerRadius: 0,
      pieOuterRadius: param.width - 3,
    },
    labels: {
      outer: {
        format: "none",
      },
      inner: {
        format: "none",
      },
    },
    data: {
      sortOrder: "value-asc",
      content: dataset,
    },
    effects: {
      load: {
        effect: "none",
      },
      pullOutSegmentOnClick: {
        effect: "none",
      },
    },
    tooltips: {
      enabled: false,
    },
    callbacks: {
      onMouseoverSegment: function (pro) {
        var cname = pro.data.cityname;
        var gbcode = pro.data.gbcode;
        var arries = $(pro.segment)
          .parents("div[class^=my-custom-layer]")
          .css("transform")
          .replace("matrix(", "")
          .replace(")", "")
          .replace(" ", "")
          .split(",");
        var maptrans = $(".leaflet-map-pane")
          .css("transform")
          .replace("matrix(", "")
          .replace(")", "")
          .replace(" ", "")
          .split(",");
        propertiesBox(cname, gbcode);
        var left =
          parseInt(param.width * 2) +
          (parseInt(arries[4]) + parseInt(maptrans[4]));
        var top =
          parseInt(param.height) +
          (parseInt(arries[5]) + parseInt(maptrans[5]));
        $("#app").children(".property_popup").css({ left: left, top: top });
        // 与统计表格联动
        hightlightStore.paramHighlight(gbcode, "map");
      },
      onMouseoutSegment: function (pro) {
        $("#app").children(".property_popup").remove();
        // 与统计表格联动
        hightlightStore.paramCancelHighlight("map");
      },
      onClickSegment: function (pro) {
        var gbcode = pro.data.gbcode;
        // 中心点经纬度
        var latlng = param.latlng;
        var zoom = getZoomByGbcode(gbcode);
        map.setView(latlng, zoom); // 设置地图中心点为选中的行政区
        redrawStaticLayers(gbcode);
      },
    },
    opacity: opacityStore[code] || 0.7,
  };
  new d3pie(el, options);
}

/**
 * 绘制条形图
 */
function drawColumnCharts(el, options, dataset, code) {
  var width = options.width,
    height = options.height;
  var svg = d3
    .select(el)
    .append("svg")
    .attr("width", width)
    .attr("height", height);
  var padding = { left: 0, right: 0, top: 1, bottom: 1 };

  var datas = [];
  for (var idx in dataset) {
    datas.push(dataset[idx].value);
  }

  //X轴的比例尺
  var xScale = d3.scale
    .ordinal()
    .domain(d3.range(datas.length))
    .rangeRoundBands([0, width - padding.left - padding.right]);
  var maxdata = d3.max(datas);
  var mindata = d3.min(datas);
  if (mindata > 0) {
    if (mindata > (maxdata - mindata) / 2) {
      mindata = mindata - (maxdata - mindata) / 2;
    } else {
      mindata = 0;
    }
  } else {
    mindata = mindata - (maxdata - mindata) / 2;
  }

  //y轴的比例尺
  var yScale = d3.scale
    .linear()
    .domain([mindata, maxdata])
    .range([height - padding.top - padding.bottom, 0]);

  //添加矩形元素
  var rects = svg
    .selectAll(".MyRect")
    .data(dataset)
    .enter()
    .append("rect")
    .attr("class", "MyRect")
    .attr("transform", "translate(" + padding.left + "," + padding.top + ")")
    .attr("x", function (d, i) {
      return xScale(i);
    })
    .attr("width", xScale.rangeBand())
    .attr("y", function (d) {
      return yScale(d.value);
    })
    .attr("height", function (d) {
      return height - padding.top - padding.bottom - yScale(d.value);
    })
    .attr("fill", function (d, i) {
      return d.color;
    })
    .style("fill-opacity", opacityStore[code] || 0.7);

  rects
    .on("mouseover", function (d, i) {
      var cname = d.cityname;
      var gbcode = d.gbcode;
      var arries = $(svg[0][0].parentNode)
        .css("transform")
        .replace("matrix(", "")
        .replace(")", "")
        .replace(" ", "")
        .split(",");
      var maptrans = $(".leaflet-map-pane")
        .css("transform")
        .replace("matrix(", "")
        .replace(")", "")
        .replace(" ", "")
        .split(",");
      propertiesBox(cname, gbcode);
      var left =
        parseInt(options.width) + (parseInt(arries[4]) + parseInt(maptrans[4]));
      var top =
        parseInt(options.height / 2) +
        (parseInt(arries[5]) + parseInt(maptrans[5]));
      $("#app").children(".property_popup").css({ left: left, top: top });
      // 与统计表格联动
      hightlightStore.paramHighlight(gbcode, "map");
    })
    .on("mouseout", function () {
      $("#app").children(".property_popup").remove();
      // 与统计表格联动
      hightlightStore.paramCancelHighlight("map");
    })
    .on("click", function (d) {
      var gbcode = d.gbcode;
      // 中心点经纬度
      var latlng = options.latlng;
      var zoom = getZoomByGbcode(gbcode);
      map.setView(latlng, zoom); // 设置地图中心点为选中的行政区
      redrawStaticLayers(gbcode);
    });
}

/**
 * 绘制圆形marker
 * @param el 	  marker的div对象
 * @param params  marker的设置参数
 * @param code    专题code
 * @param shape   形状，圆形还是方形
 */
function drawShapeMarker(el, option, code, shape) {
  $(el).html('<div class="shape-marker"><div class="shape"></div></div>');
  $(el).find(".shape-marker").css({ position: "relative" });
  var shp = $(el).find(".shape");
  var radius = option.radius;
  var fillOpacity = option.fillOpacity;
  var fillColor = option.fillColor;
  var cname = option.cname;
  var gbcode = option.gbcode;
  var latlng = option.latlng;
  // 圆形覆盖物
  if (shape == "rectang") {
    radius = 0;
  }
  shp.css({
    width: option.radius,
    height: option.radius,
    "border-radius": radius,
    background: fillColor,
    opacity: fillOpacity,
    position: "absolute",
    left: "50%",
    top: "50%",
    "margin-left": -option.radius,
    "margin-top": -option.radius,
  });
  shp
    .on("mouseover", function (evt) {
      // 获取所有统计图层的属性
      propertiesBox(cname, gbcode);
      var point = map.latLngToLayerPoint(latlng);
      // 地图偏移量
      var maptrans = $(".leaflet-map-pane")
        .css("transform")
        .replace("matrix(", "")
        .replace(")", "")
        .replace(" ", "")
        .split(",");
      var left = point.x + parseInt(maptrans[4]) + option.radius / 2 + "px";
      var top = point.y + parseInt(maptrans[5]) + "px";
      $("#app").children(".property_popup").css({ left: left, top: top });
      // 与统计表格联动
      hightlightStore.paramHighlight(gbcode, "map");
    })
    .on("mouseout", function () {
      // 与统计表格联动
      $("#app").children(".property_popup").remove();
      // 与统计表格和统计图联动
      hightlightStore.paramCancelHighlight("map");
    })
    .on("click", function () {
      // 中心点经纬度,设置地图中心点为选中的行政区
      var zoom = getZoomByGbcode(gbcode);
      map.setView(latlng, zoom);
      redrawStaticLayers(gbcode);
    });
}

var MyCustomLayer = L.Class.extend({
  initialize: function (latlng, dataset, category, code, option) {
    this._latlng = latlng;
    this._dataset = dataset;
    this._category = category;
    this._code = code;
    this._option = option;
  },

  onAdd: function (map) {
    this._map = map;
    this._el = L.DomUtil.create(
      "div",
      "my-custom-layer_" + this._code + " leaflet-zoom-hide"
    );
    map.getPanes().overlayPane.appendChild(this._el);
    L.DomEvent.disableClickPropagation(this._el);
    map.on("viewreset", this._reset, this);
    this._reset();
  },

  onRemove: function (map) {
    map.getPanes().overlayPane.removeChild(this._el);
    map.off("viewreset", this._reset, this);
  },

  _reset: function () {
    this._el.innerHTML = "";
    var zoom = this._map.getZoom();
    var width = (height = zoom * 5 - 5);
    if (width <= 0) {
      return;
    }
    var params = { width: width, height: height, latlng: this._latlng };
    var pos = this._map.latLngToLayerPoint(this._latlng);
    if (this._category == "pie") {
      pos.x = pos.x - params.width;
      pos.y = pos.y - params.height;
      drawPieCharts(this._el, params, this._dataset, this._code); // 绘制饼图
    } else if (this._category == "column") {
      params.height = (zoom * 5 - 5) * 2;
      pos.x = pos.x - params.width / 2;
      pos.y = pos.y - params.height / 2;
      drawColumnCharts(this._el, params, this._dataset, this._code); // 绘制条形图
    } else if (this._category == "circle" || this._category == "rectang") {
      pos.x = pos.x + this._option.radius / 2;
      pos.y = pos.y + this._option.radius / 2 + 2;
      drawShapeMarker(this._el, this._option, this._code, this._category);
    }
    L.DomUtil.setPosition(this._el, pos);
  },
});

/**
 * 生成属性查新弹出框
 */
function propertiesBox(cname, gbcode) {
  var properties = getProperties(gbcode);
  var tips = [],
    cols = [],
    props = [],
    prop = {}; // [{properties:properties},]
  if (properties.length == 0) {
    tips.push("资料暂缺！");
  } else {
    for (var i = 0; i < properties.length; i++) {
      props.push(properties[i]);
      if ((i + 1) % 10 == 0) {
        prop.properties = props;
        cols.push(prop);
        prop = {};
        props = [];
      }
    }
    if (i % 10 != 0) {
      prop.properties = props;
      cols.push(prop);
    }
  }

  var json = { title: cname, cols: cols, tips: tips };
  var htmlPopup = MT.render(T["popup"], json);
  $("#app").children(".property_popup").remove();
  $("#app").append(htmlPopup);
}

/**
 * 重绘分级设色专题
 */
function redrawPolygon(code, selectColors) {
  shapeRecords[code].type = "polygon";
  shapeRecords[code].color = undefined;
  shapeRecords[code].shape = undefined;
  colors[code] = selectColors;
  redraw();
}

/**
 * 重绘符号图专题
 * @param options 重绘符号图所需的参数
 */
function redrawSymbol(options) {
  shapeRecords = options.shapeRecords;
  radiuses = options.radiuses;
  redraw();
}

/**
 * 透明度改变的情况下，重绘专题图
 * @param opacities 透明度集合
 */
function redraw(opacities, checks) {
  opacityStore = opacities || opacityStore;
  checkedNodes = checks || checkedNodes;
  redrawStaticLayers();
}

/**
 * 重新设置图层的叠加顺序
 */
function resetLayersZIndex() {
  var len = checkedNodes.length - 1;
  for (var i = len; i >= 0; i--) {
    var code = checkedNodes[i].code;
    if (!layersCache[code]) {
      continue;
    }
    var layer = layersCache[code];
    map.addLayer(layer);
    // 不是marker类图层，属于svg图层
    if ($(".leaflet-overlay-pane .my-custom-layer_" + code).length == 0) {
      $(".leaflet-overlay-pane .leaflet-zoom-animated").css({
        "z-index": len - i + 4,
      });
    } else if ($(".leaflet-overlay-pane .my-custom-layer_" + code).length > 0) {
      $(".leaflet-overlay-pane .my-custom-layer_" + code).css({
        "z-index": len - i + 4,
      });
    }

    if (
      $(".leaflet-overlay-pane .leaflet-zoom-animated").children().length == 0
    ) {
      $(".leaflet-overlay-pane .leaflet-zoom-animated").css({ "z-index": 3 });
    }
  }
}

/**
 * 判断是否是直辖市
 */
function isMunicipalities(gbcode) {
  if (
    gbcode == "156110000" ||
    gbcode == "156120000" ||
    gbcode == "156310000" ||
    gbcode == "156500000"
  ) {
    return true;
  }
}

/**
 * 高亮当前行政区
 */
function highlight(gbcode) {
  // 获取所有统计图层的属性
  var layer = layerInfos[gbcode];
  var feature;
  if (layer && layer._map) {
    feature = layer.feature;
    layer.setStyle({ dashArray: "0", weight: 5, color: "#0002fb" });
    layer.bringToFront();
  } else {
    for (var i = 0; i < graphicInfos.features.length; i++) {
      var ft = graphicInfos.features[i];
      if ("156" + ft.properties["GB"] == gbcode) {
        feature = ft;
        break;
      }
    }
  }
  var cityname = feature.properties["CNAME"];
  propertiesBox(cityname, gbcode);
  var lng = feature.properties["lng"];
  var lat = feature.properties["lat"];
  var latlng = L.latLng(lat, lng);
  var point = map.latLngToContainerPoint(latlng);
  var left = point.x + "px";
  var top = point.y + "px";
  $("#app").children(".property_popup").css({ left: left, top: top });
}

/**
 * 取消高亮
 */
function cancelHighlight() {
  for (var i in layerInfos) {
    layerInfos[i].setStyle({ dashArray: "0", weight: 2, color: "#ffffff" });
    if (gbGeoJson && xjGeojson) {
      gbGeoJson.bringToFront();
      xjGeojson.bringToFront();
    }
  }
  $("#app").children(".property_popup").remove();
}

/**
 * 加载地图数据失败
 */
function errorFunc() {
  throw "加载地图数据失败";
}

export default {
  loadMapLayers: loadMapLayers,
  clearLayer: clearLayer,
  redrawPolygon: redrawPolygon,
  redrawSymbol: redrawSymbol,
  redraw: redraw,
  highlight: highlight,
  cancelHighlight: cancelHighlight,
};
