<template>
  <div id="app">
    <div id="map-container"></div>
    <div class="control-panel">
      <el-button @click="zoomIn()">放大</el-button>
      <el-button @click="zoomOut()">缩小</el-button>
      <el-button @click="panTo(--center.lng, center.lat)">左移1度</el-button>
      <el-button @click="panTo(++center.lng, center.lat)">右移1度</el-button>
      <el-button @click="toggleDrag">{{ dragText }}</el-button>
      <el-button @click="showVisualRegion">获取显示范围</el-button>
      <el-button @click="setStyle()">默认主题</el-button>
      <el-button @click="setStyle('indigo')">深蓝主题</el-button>
      <el-button @click="setStyle('black')">黑色主题</el-button>
      <el-button @click="getMapStatus()">获取当前地图信息</el-button>
      <br />
      <span>设置可缩放范围：</span
      ><el-slider v-model="scaleRange" :max="18" range show-stops></el-slider>
      <div></div>
    </div>
  </div>
</template>

<script>
import axios from "axios";

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

export default {
  name: "App",
  components: {
    // HelloWorld,
  },
  data() {
    return {
      map: null,
      center: {
        lng: 116.40769,
        lat: 39.89945,
      },
      zoom: 4,
      canDrag: true,
      scaleRange: [1, 17],
    };
  },
  async mounted() {
    this.map = new T.Map("map-container");
    this.map.centerAndZoom(
      new T.LngLat(this.center.lng, this.center.lat),
      this.zoom
    );

    let border = await axios.get(
      "https://zhfw.tianditu.gov.cn/zhfw/border?gbcode=156000000&type=s"
    );
    console.log(border);
    var regions = JSON.parse(border.geodata);
    for (var f in regions.features) {
      regions.features[f] = L.GeoJSON.Encoded.prototype._decodeFeature(
        regions.features[f]
      );
    }
    // regionsCache[gbcode] = regions;
    requestData(gbcode, regions, "s");
  },
  computed: {
    dragText() {
      if (this.canDrag) {
        return "禁用拖拽";
      } else {
        return "恢复拖拽";
      }
    },
  },
  methods: {
    zoomIn(map) {
      if (map) {
        map.zoomIn();
      } else {
        this.map.zoomIn();
      }
    },
    zoomOut(map) {
      if (map) {
        map.zoomOut();
      } else {
        this.map.zoomOut();
      }
    },
    panTo(lng, lat) {
      this.map.panTo(new T.LngLat(lng, lat));
    },
    toggleDrag() {
      if (this.canDrag) {
        this.map.disableDrag();
        this.canDrag = false;
      } else {
        this.map.enableDrag();
        this.canDrag = true;
      }
    },
    showVisualRegion() {
      var bs = this.map.getBounds(); //获取可视区域
      var bssw = bs.getSouthWest(); //可视区域左下角
      var bsne = bs.getNorthEast(); //可视区域右上角
      alert(
        "当前地图可视范围是：" +
          bssw.lng +
          "," +
          bssw.lat +
          "到" +
          bsne.lng +
          "," +
          bsne.lat
      );
    },
    setStyle(type) {
      if (!type) {
        this.map.removeStyle();
      } else {
        this.map.setStyle(type);
      }
    },
    getMapStatus() {
      return {
        mapCenter: {
          lng: this.map.getCenter().getLng(),
          lat: this.map.getCenter().getLat(),
        },
        zoom: this.map.getZoom(),
        bounds: this.map.getBounds(),
      };
    },
  },
  watch: {
    scaleRange: {
      handler(val) {
        this.map.setMinZoom(val[0]);
        this.map.setMaxZoom(val[1]);
      },
      deep: true,
    },
  },
};
</script>

<style lang="less">
html,
body {
  height: 100%;
  width: 100%;
  margin: 0;
  padding: 0;
}
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  width: 100%;
  height: 100%;
}
#map-container {
  width: 100%;
  height: 100%;
}
.control-panel {
  width: 200px;
  top: 10px;
  left: 10px;
  height: auto;
  position: fixed;
  z-index: 99999;
  background: #ffffffee;
  padding: 10px;
  box-sizing: border-box;
  box-shadow: 0 0 5px #2c3e5063;
  border-radius: 5px;
  .el-button {
    margin: 5px;
  }
}
</style>
