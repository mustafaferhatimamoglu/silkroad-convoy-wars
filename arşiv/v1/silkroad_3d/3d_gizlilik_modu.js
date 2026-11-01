// 3d_gizlilik_modu.js

class GizlilikModülü {
  _properties = {
    kameraGizlilik: null,
    oyuncuGizlilik: null,
    ortamGizlilik: null,
    hedefGizlilik: null
  };

  _methods = {
    initGizlilikModülü: () => {
      this._properties.kameraGizlilik = 0;
      this._properties.oyuncuGizlilik = 0;
      this._properties.ortamGizlilik = 0;
      this._properties.hedefGizlilik = 0;
    },
    setKameraGizlilik: (gizlilik) => {
      this._properties.kameraGizlilik = gizlilik;
    },
    setOyuncuGizlilik: (gizlilik) => {
      this._properties.oyuncuGizlilik = gizlilik;
    },
    setOrtamGizlilik: (gizlilik) => {
      this._properties.ortamGizlilik = gizlilik;
    },
    setHedefGizlilik: (gizlilik) => {
      this._properties.hedefGizlilik = gizlilik;
    },
    updateGizlilik: () => {
      // Update logic here
    }
  };
}

// Initialize the GizlilikModülü instance
let gizlilikModülüInstance = new GizlilikModülü();
gizlilikModülüInstance._methods.initGizlilikModülü();

// Example usage:
gizlilikModülüInstance._methods.setKameraGizlilik(0.5);
gizlilikModülüInstance._methods.setOyuncuGizlilik(0.8);
gizlilikModülüInstance._methods.setOrtamGizlilik(0.3);
gizlilikModülüInstance._methods.setHedefGizlilik(0.2);
gizlilikModülüInstance._methods.updateGizlilik();