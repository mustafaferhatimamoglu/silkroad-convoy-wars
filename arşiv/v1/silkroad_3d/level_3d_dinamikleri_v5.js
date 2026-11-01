// level_3d_dinamikleri_v5.js

// Level sınıfı
class Level {
  constructor(level_number, properties, animations, events) {
    this.level_number = level_number;
    this.properties = properties;
    this.animations = animations;
    this.events = events;
    this.players = [];
  }

  addPlayer(player) {
    this.players.push(player);
  }

  removePlayer(player) {
    this.players = this.players.filter(p => p.player_id !== player.player_id);
  }
}

// Player sınıfı
class Player {
  constructor(player_id, position, direction, score, inventory, level) {
    this.player_id = player_id;
    this.position = position;
    this.direction = direction;
    this.score = score;
    this.inventory = inventory;
    this.level = level;
  }

  move(new_position) {
    this.position = new_position;
  }

  collect_item(item) {
    this.inventory.push(item);
  }

  update_score(amount) {
    this.score += amount;
  }
}

// GizlilikModu sınıfı
class GizlilikModu {
  constructor(enabled, player) {
    this.enabled = enabled;
    this.player = player;
  }
}

// Level özellikleri ve dinamikleri
const levels = [
  new Level(1, { name: "Basit Seher", difficulty: "kolay" }, [], []),
  new Level(2, { name: "Kuvvetli Kaya", difficulty: "orta" }, [], []),
  new Level(3, { name: "Zor Bozuk", difficulty: "zor" }, [], [])
];

// Oyuncular
const players = [
  new Player(1, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, 0, [], levels[0]),
  new Player(2, { x: 10, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, 0, [], levels[0])
];

// Gizlilik modu
let gizlilik_modu = new GizlilikModu(false, players[0]);

// Fonksiyonlar
function get_level_properties(level) {
  return levels.find(l => l.level_number === level).properties;
}

function enable_gizlilik_modu(player) {
  gizlilik_modu = new GizlilikModu(true, player);
}

function disable_gizlilik_modu(player) {
  if (gizlilik_modu.player === player) {
    gizlilik_modu = new GizlilikModu(false, null);
  }
}

function start_level(player) {
  player.level.addPlayer(player);
}

function end_level(player) {
  player.level.removePlayer(player);
}

function update_level(player, action) {
  switch (action) {
    case "move":
      player.move({ x: player.position.x + 1, y: player.position.y, z: player.position.z });
      break;
    case "collect":
      player.collect_item("item");
      player.update_score(10);
      break;
  }
}

function calculate_level_rewards(player) {
  return player.score;
}