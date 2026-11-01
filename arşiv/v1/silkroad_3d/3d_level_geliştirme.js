// 3d_level_geliştirme.js

class Level {
    constructor(id, name, path) {
        this.id = id;
        this.name = name;
        this.path = path;
        this.objects = [];
    }

    addObject(object) {
        this.objects.push(object);
    }

    removeObject(objectId) {
        this.objects = this.objects.filter(obj => obj.id !== objectId);
    }

    updateObject(objectId, newProperties) {
        let object = this.objects.find(obj => obj.id === objectId);
        if (object) {
            Object.assign(object, newProperties);
        }
        return object;
    }
}

class LevelManager {
    constructor() {
        this.levels = [];
    }

    loadLevel(levelId) {
        let level = this.levels.find(l => l.id === levelId);
        if (!level) {
            level = new Level(levelId, "Unknown", "unknown/path");
            this.levels.push(level);
        }
        return level;
    }

    updateLevel(levelId, newProperties) {
        let level = this.levels.find(l => l.id === levelId);
        if (level) {
            Object.assign(level, newProperties);
        }
        return level;
    }

    deleteLevel(levelId) {
        let index = this.levels.findIndex(l => l.id === levelId);
        if (index !== -1) {
            return this.levels.splice(index, 1)[0];
        }
        return null;
    }
}

class ObjectManager {
    constructor() {
        this.objects = [];
    }

    loadObject(objectId) {
        let object = this.objects.find(obj => obj.id === objectId);
        if (!object) {
            object = { id: objectId, type: "unknown" };
            this.objects.push(object);
        }
        return object;
    }

    updateObject(objectId, newProperties) {
        let object = this.objects.find(obj => obj.id === objectId);
        if (object) {
            Object.assign(object, newProperties);
        }
        return object;
    }

    deleteObject(objectId) {
        let index = this.objects.findIndex(obj => obj.id === objectId);
        if (index !== -1) {
            return this.objects.splice(index, 1)[0];
        }
        return null;
    }
}

function createLevel(levelId, levelName, levelPath) {
    return new Level(levelId, levelName, levelPath);
}

function loadLevel(levelId) {
    return new LevelManager().loadLevel(levelId);
}

function updateLevel(levelId, newProperties) {
    return new LevelManager().updateLevel(levelId, newProperties);
}

function deleteLevel(levelId) {
    return new LevelManager().deleteLevel(levelId);
}

function addObject(levelId, object) {
    let level = new LevelManager().loadLevel(levelId);
    level.addObject(object);
    return level;
}

function removeObject(levelId, objectId) {
    let level = new LevelManager().loadLevel(levelId);
    level.removeObject(objectId);
    return level;
}

function updateObject(levelId, objectId, newProperties) {
    let level = new LevelManager().loadLevel(levelId);
    level.updateObject(objectId, newProperties);
    return level.objects.find(obj => obj.id === objectId);
}

// Örnek Kullanım
// let newLevel = createLevel("level1", "Sample Level", "path/to/level1");
// let loadedLevel = loadLevel("level1");
// let updatedLevel = updateLevel("level1", { name: "Updated Level" });
// let deletedLevel = deleteLevel("level1");
// let addedObject = addObject("level1", { id: "obj1", type: "tree" });
// let removedObject = removeObject("level1", "obj1");
// let updatedObject = updateObject("level1", "obj1", { type: "rock" });