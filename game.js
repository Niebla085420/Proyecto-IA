/*
  La Carrera Monstruosa — Reglas y motor de carrera
  Copyright (c) 2026 Proyecto personal
  Uso personal; no distribuido públicamente.
  Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
*/
(function () {
  "use strict";

  const characterList = [
    { id: "witch", name: "Bruja", power: "Vuelo", description: "La escoba te mantiene en el aire un instante.", color: "#e98253", secondary: "#f1c970" },
    { id: "ghost", name: "Fantasma", power: "Fase", description: "Te vuelves intangible durante un instante.", color: "#b5d9cb", secondary: "#edf0dd" },
    { id: "vampire", name: "Vampiro", power: "Escudo", description: "Los murciélagos detienen un impacto.", color: "#ad5152", secondary: "#edb06d" },
    { id: "werewolf", name: "Hombre lobo", power: "Salto largo", description: "Un salto poderoso supera huecos grandes y obstáculos altos.", color: "#8c9d63", secondary: "#d9c990" },
    { id: "skeleton", name: "Esqueleto", power: "Bumerán", description: "Un hueso rompe el primer obstáculo cercano.", color: "#e9e1c9", secondary: "#b8c197" }
  ];
  const recordsKey = "carrera-monstruosa-records-v1";
  const laneCount = 3;
  const roadHorizonY = 300;
  const roadNearY = 540;
  const baseCooldown = 10;
  const abilityDuration = 1.5;

  function getCharacter(characterId) {
    let foundCharacter = characterList[0];
    characterList.forEach(function (character) {
      if (character.id === characterId) {
        foundCharacter = character;
      }
    });
    return foundCharacter;
  }

  function moveLane(currentLane, direction) {
    let nextLane = currentLane;
    if (direction < 0) {
      nextLane = Math.max(0, currentLane - 1);
    } else if (direction > 0) {
      nextLane = Math.min(laneCount - 1, currentLane + 1);
    }
    return nextLane;
  }

  function reduceCooldown(secondsRemaining, reductionSeconds) {
    const safeRemaining = Number.isFinite(secondsRemaining) ? Math.max(0, secondsRemaining) : 0;
    const safeReduction = Number.isFinite(reductionSeconds) ? Math.max(0, reductionSeconds) : 0;
    const remaining = Math.max(0, safeRemaining - safeReduction);
    return remaining;
  }

  function getJumpVelocity(characterId, longJumpActive) {
    const velocity = characterId === "werewolf" && longJumpActive ? 810 : 570;
    return velocity;
  }

  function canBreakObstacle(characterId, abilityActive, sameLane) {
    const canBreak = characterId === "skeleton" && abilityActive && sameLane;
    return canBreak;
  }

  function canJumpObstacle(obstacleKind) {
    const canJump = obstacleKind === "root" || obstacleKind === "log" || obstacleKind === "gap";
    return canJump;
  }

  function getBiome(distanceMeters) {
    let biome = "castle";
    if (distanceMeters >= 1100) {
      biome = "cemetery";
    } else if (distanceMeters >= 450) {
      biome = "forest";
    }
    return biome;
  }

  function normalizeRecords(value) {
    const records = { overall: 0, byCharacter: {} };
    let valid = value !== null && typeof value === "object" && !Array.isArray(value);
    if (valid && Number.isFinite(value.overall) && value.overall >= 0) {
      records.overall = Math.floor(value.overall);
    } else if (valid && value.overall !== undefined) {
      valid = false;
    }
    if (valid) {
      const source = value.byCharacter;
      if (source !== undefined && (source === null || typeof source !== "object" || Array.isArray(source))) {
        valid = false;
      } else if (source) {
        characterList.forEach(function (character) {
          const score = source[character.id];
          if (score !== undefined && Number.isFinite(score) && score >= 0) {
            records.byCharacter[character.id] = Math.floor(score);
          } else if (score !== undefined) {
            valid = false;
          }
        });
      }
    }
    const result = valid ? { ok: true, value: records } : { ok: false, error: "invalid-records" };
    return result;
  }

  function updateRecord(currentRecords, characterId, distanceMeters) {
    const normalized = normalizeRecords(currentRecords);
    let result = normalized;
    if (normalized.ok && Number.isFinite(distanceMeters) && distanceMeters >= 0) {
      const nextRecords = { overall: normalized.value.overall, byCharacter: Object.assign({}, normalized.value.byCharacter) };
      const distance = Math.floor(distanceMeters);
      const characterRecord = nextRecords.byCharacter[characterId] || 0;
      nextRecords.overall = Math.max(nextRecords.overall, distance);
      nextRecords.byCharacter[characterId] = Math.max(characterRecord, distance);
      result = { ok: true, value: nextRecords };
    } else if (!normalized.ok) {
      result = normalized;
    } else {
      result = { ok: false, error: "invalid-distance" };
    }
    return result;
  }

  function isObstacleAvoided(characterId, obstacleKind, jumpHeight, abilityActive, shieldAvailable) {
    let avoided = false;
    if (abilityActive && characterId === "ghost") {
      avoided = true;
    } else if (abilityActive && characterId === "witch" && canJumpObstacle(obstacleKind)) {
      avoided = true;
    } else if (abilityActive && characterId === "werewolf" && (obstacleKind === "gap" || obstacleKind === "armor" || obstacleKind === "block" || obstacleKind === "tombstone" || obstacleKind === "gate")) {
      avoided = true;
    } else if (abilityActive && characterId === "vampire" && shieldAvailable) {
      avoided = true;
    } else if (jumpHeight > 34 && canJumpObstacle(obstacleKind)) {
      avoided = true;
    }
    return avoided;
  }

  function storageRead() {
    let result = { ok: true, value: { overall: 0, byCharacter: {} }, persistent: true };
    try {
      const storedValue = window.localStorage.getItem(recordsKey);
      if (storedValue !== null) {
        let parsedValue = null;
        try {
          parsedValue = JSON.parse(storedValue);
        } catch (error) {
          if (error instanceof SyntaxError) {
            result = { ok: false, error: "invalid-json", value: { overall: 0, byCharacter: {} }, persistent: false };
          } else {
            throw error;
          }
        }
        if (parsedValue !== null) {
          const normalized = normalizeRecords(parsedValue);
          result = normalized.ok
            ? { ok: true, value: normalized.value, persistent: true }
            : { ok: false, error: normalized.error, value: { overall: 0, byCharacter: {} }, persistent: false };
        }
      }
    } catch (error) {
      if (error instanceof DOMException && (error.name === "SecurityError" || error.name === "QuotaExceededError")) {
        result = { ok: false, error: "storage-unavailable", value: { overall: 0, byCharacter: {} }, persistent: false };
      } else {
        throw error;
      }
    }
    return result;
  }

  function storageWrite(records) {
    let result = { ok: false, error: "invalid-records" };
    const normalized = normalizeRecords(records);
    if (normalized.ok) {
      try {
        window.localStorage.setItem(recordsKey, JSON.stringify(normalized.value));
        result = { ok: true, value: normalized.value };
      } catch (error) {
        if (error instanceof DOMException && (error.name === "SecurityError" || error.name === "QuotaExceededError")) {
          result = { ok: false, error: "storage-unavailable" };
        } else {
          throw error;
        }
      }
    }
    return result;
  }

  const gameRules = {
    characters: characterList,
    getCharacter: getCharacter,
    laneX: laneX,
    roadHorizonY: roadHorizonY,
    moveLane: moveLane,
    reduceCooldown: reduceCooldown,
    getJumpVelocity: getJumpVelocity,
    canBreakObstacle: canBreakObstacle,
    canJumpObstacle: canJumpObstacle,
    getBiome: getBiome,
    normalizeRecords: normalizeRecords,
    updateRecord: updateRecord,
    isObstacleAvoided: isObstacleAvoided,
    baseCooldown: baseCooldown,
    abilityDuration: abilityDuration,
    crystalCooldownReduction: 3
  };
  if (typeof window !== "undefined") {
    window.CarreraMonstruosaRules = gameRules;
  }

  const canvas = document.getElementById("gameCanvas");
  if (!canvas) {
    return;
  }
  const context = canvas.getContext("2d");
  const hud = document.getElementById("hud");
  const menuScreen = document.getElementById("menuScreen");
  const pauseScreen = document.getElementById("pauseScreen");
  const resultScreen = document.getElementById("resultScreen");
  const startButton = document.getElementById("startButton");
  const retryButton = document.getElementById("retryButton");
  const resumeButton = document.getElementById("resumeButton");
  const pauseButton = document.getElementById("pauseButton");
  const changeCharacterButton = document.getElementById("changeCharacterButton");
  const characterButtons = Array.from(document.querySelectorAll(".character-choice"));
  const touchControls = document.getElementById("touchControls");
  const powerDescriptions = { witch: "La escoba te mantiene en el aire un instante.", ghost: "Te vuelves intangible durante un instante.", vampire: "Los murciélagos detienen un impacto.", werewolf: "Un salto poderoso supera huecos grandes y obstáculos altos.", skeleton: "Un hueso rompe el primer obstáculo cercano." };
  const biomeNames = { castle: "CASTILLO ABANDONADO", forest: "BOSQUE SOMBRÍO", cemetery: "CEMENTERIO" };
  const obstacleDescriptions = { castle: "ARMADURAS · BLOQUES · HUECOS", forest: "RAÍCES · TRONCOS · HUECOS", cemetery: "LÁPIDAS · REJAS · FOSAS" };
  const obstacleNames = { castle: ["armor", "block", "gap"], forest: ["root", "log", "gap"], cemetery: ["tombstone", "gate", "gap"] };
  const palette = {
    castle: { sky: "#45575a", far: "#344847", near: "#253d39", ground: "#a09370", track: "#71664f", accent: "#e7b968", mist: "rgba(213, 224, 205, .14)" },
    forest: { sky: "#355a4a", far: "#274939", near: "#1d3e34", ground: "#829168", track: "#58644a", accent: "#dd9a61", mist: "rgba(203, 223, 179, .13)" },
    cemetery: { sky: "#475354", far: "#364447", near: "#26383a", ground: "#8a8974", track: "#626458", accent: "#d9bd74", mist: "rgba(224, 231, 219, .18)" }
  };

  let selectedCharacter = "witch";
  let recordsState = storageRead();
  let animationFrame = 0;
  let lastFrameTime = 0;
  let obstacleTimer = 0;
  let crystalTimer = 0;
  let state = createState(selectedCharacter);

  function createState(characterId) {
    const freshState = {
      phase: "menu", characterId: characterId, lane: 1, distance: 0, speed: 250, jumpHeight: 0, jumpVelocity: 0,
      cooldown: 0, abilityTime: 0, shieldAvailable: false, boneActive: false, obstacles: [], crystals: [],
      particles: [], crystalsCollected: 0, previousBiome: "castle", elapsed: 0, invulnerableTime: 0
    };
    return freshState;
  }

  function roundRect(drawContext, x, y, width, height, radius) {
    const safeRadius = Math.min(radius, width / 2, height / 2);
    drawContext.beginPath();
    drawContext.moveTo(x + safeRadius, y);
    drawContext.arcTo(x + width, y, x + width, y + height, safeRadius);
    drawContext.arcTo(x + width, y + height, x, y + height, safeRadius);
    drawContext.arcTo(x, y + height, x, y, safeRadius);
    drawContext.arcTo(x, y, x + width, y, safeRadius);
    drawContext.closePath();
  }

  function laneX(lane, depthY) {
    const projectedY = depthY === undefined ? 433 : Math.max(roadHorizonY, Math.min(roadNearY, depthY));
    const perspective = (projectedY - roadHorizonY) / (roadNearY - roadHorizonY);
    const leftEdge = 255 + (35 - 255) * perspective;
    const rightEdge = 705 + (925 - 705) * perspective;
    const position = leftEdge + (lane + .5) * (rightEdge - leftEdge) / 3;
    return position;
  }

  function drawHill(drawContext, color, baseY, amplitude, phaseOffset) {
    drawContext.fillStyle = color;
    drawContext.beginPath();
    drawContext.moveTo(0, baseY);
    for (let point = 0; point <= 12; point += 1) {
      const pointX = point * 80;
      const pointY = baseY - Math.sin(point * 0.7 + phaseOffset) * amplitude - (point % 4 === 0 ? amplitude * 0.7 : 0);
      drawContext.lineTo(pointX, pointY);
    }
    drawContext.lineTo(960, 540);
    drawContext.lineTo(0, 540);
    drawContext.closePath();
    drawContext.fill();
  }

  function drawAmbientDetails(drawContext, biome, time) {
    drawContext.save();
    if (biome === "castle") {
      const bats = [[331, 180], [379, 143], [432, 201], [690, 173]];
      drawContext.fillStyle = "#293d3b";
      bats.forEach(function (bat, index) {
        const batX = bat[0] + Math.sin(time * 1.3 + index) * 12;
        const batY = bat[1] + Math.cos(time * 1.7 + index) * 5;
        const wingHeight = 5 + Math.abs(Math.sin(time * 11 + index)) * 5;
        drawContext.beginPath();
        drawContext.moveTo(batX - 13, batY - wingHeight);
        drawContext.lineTo(batX - 5, batY);
        drawContext.lineTo(batX, batY - 3);
        drawContext.lineTo(batX + 5, batY);
        drawContext.lineTo(batX + 13, batY - wingHeight);
        drawContext.lineTo(batX + 8, batY + 4);
        drawContext.lineTo(batX, batY + 2);
        drawContext.lineTo(batX - 8, batY + 4);
        drawContext.closePath();
        drawContext.fill();
      });
    } else if (biome === "forest") {
      const lights = [[76, 298], [292, 257], [668, 300], [889, 274], [580, 224]];
      lights.forEach(function (light, index) {
        const pulse = .42 + (Math.sin(time * 3 + index * 1.7) + 1) * .22;
        const lightX = light[0] + Math.sin(time * .8 + index) * 8;
        const lightY = light[1] + Math.cos(time * 1.1 + index) * 5;
        drawContext.globalAlpha = pulse;
        drawContext.strokeStyle = index % 2 === 0 ? "#f4cb70" : "#b8e4ad";
        drawContext.lineWidth = 2;
        drawContext.beginPath();
        drawContext.moveTo(lightX - 5, lightY); drawContext.lineTo(lightX + 5, lightY);
        drawContext.moveTo(lightX, lightY - 5); drawContext.lineTo(lightX, lightY + 5);
        drawContext.stroke();
      });
      drawContext.globalAlpha = 1;
      drawContext.strokeStyle = "rgba(39, 57, 41, .8)";
      drawContext.lineWidth = 8;
      drawContext.beginPath();
      drawContext.moveTo(0, 244); drawContext.quadraticCurveTo(93, 189, 169, 221);
      drawContext.moveTo(960, 228); drawContext.quadraticCurveTo(875, 179, 798, 214);
      drawContext.stroke();
    } else {
      const wisps = [[94, 307], [352, 276], [749, 309], [881, 258]];
      wisps.forEach(function (wisp, index) {
        const wispX = wisp[0] + Math.sin(time * .7 + index * 2) * 7;
        const wispY = wisp[1] + Math.cos(time * 1.4 + index) * 6;
        drawContext.globalAlpha = .48 + (Math.sin(time * 2 + index) + 1) * .16;
        drawContext.fillStyle = index % 2 === 0 ? "#f0ce80" : "#b4d7c6";
        drawContext.beginPath();
        drawContext.moveTo(wispX, wispY - 9);
        drawContext.quadraticCurveTo(wispX + 9, wispY - 2, wispX + 4, wispY + 7);
        drawContext.quadraticCurveTo(wispX, wispY + 4, wispX - 4, wispY + 7);
        drawContext.quadraticCurveTo(wispX - 9, wispY - 2, wispX, wispY - 9);
        drawContext.fill();
      });
    }
    drawContext.restore();
  }

  function drawPortraitFrame(drawContext, x, y, width, height, portraitColor, hairColor, wallSide) {
    drawContext.save();
    const perspectiveSkew = wallSide === "left" ? -.24 : .24;
    drawContext.translate(x, y);
    drawContext.transform(1, 0, perspectiveSkew, 1, 0, 0);
    drawContext.strokeStyle = "#a98a56";
    drawContext.lineWidth = 2;
    drawContext.beginPath(); drawContext.moveTo(5, 0); drawContext.lineTo(width / 2, -7); drawContext.lineTo(width - 5, 0); drawContext.stroke();
    drawContext.fillStyle = "#e3c780";
    drawContext.beginPath(); drawContext.arc(width / 2, -7, 2.5, 0, Math.PI * 2); drawContext.fill();
    drawContext.shadowColor = "rgba(11, 20, 18, .55)";
    drawContext.shadowBlur = 7;
    drawContext.shadowOffsetX = wallSide === "left" ? 3 : -3;
    drawContext.shadowOffsetY = 4;
    drawContext.fillStyle = "#342b27";
    roundRect(drawContext, -4, -4, width + 8, height + 8, 4);
    drawContext.fill();
    drawContext.shadowColor = "transparent";
    drawContext.shadowBlur = 0;
    drawContext.shadowOffsetX = 0;
    drawContext.shadowOffsetY = 0;
    drawContext.fillStyle = "#d5b268";
    roundRect(drawContext, 0, 0, width, height, 3);
    drawContext.fill();
    drawContext.fillStyle = portraitColor;
    drawContext.fillRect(4, 4, width - 8, height - 8);
    drawContext.fillStyle = hairColor;
    drawContext.beginPath();
    drawContext.ellipse(width / 2, height * .39, width * .22, height * .2, 0, 0, Math.PI * 2);
    drawContext.fill();
    drawContext.fillStyle = "#e3bd91";
    drawContext.beginPath();
    drawContext.ellipse(width / 2, height * .42, width * .16, height * .15, 0, 0, Math.PI * 2);
    drawContext.fill();
    drawContext.fillStyle = "#342b27";
    drawContext.beginPath(); drawContext.arc(width * .44, height * .42, 1.4, 0, Math.PI * 2); drawContext.arc(width * .56, height * .42, 1.4, 0, Math.PI * 2); drawContext.fill();
    drawContext.strokeStyle = "#9b6250"; drawContext.lineWidth = 1.5;
    drawContext.beginPath(); drawContext.arc(width / 2, height * .48, 3, .2, Math.PI - .2); drawContext.stroke();
    drawContext.fillStyle = hairColor;
    drawContext.beginPath();
    drawContext.moveTo(width * .2, height * .9);
    drawContext.quadraticCurveTo(width * .22, height * .57, width / 2, height * .62);
    drawContext.quadraticCurveTo(width * .8, height * .57, width * .8, height * .9);
    drawContext.closePath();
    drawContext.fill();
    drawContext.restore();
  }

  function drawWallSconce(drawContext, x, y, scale) {
    drawContext.save();
    drawContext.translate(x, y);
    drawContext.scale(scale, scale);
    drawContext.strokeStyle = "#5b4132";
    drawContext.lineWidth = 5;
    drawContext.beginPath(); drawContext.moveTo(0, 0); drawContext.lineTo(11, 8); drawContext.lineTo(11, 19); drawContext.stroke();
    drawContext.fillStyle = "#d8bf83";
    drawContext.fillRect(3, 17, 17, 4);
    drawContext.fillStyle = "#f0b65c";
    drawContext.beginPath(); drawContext.moveTo(11, 17); drawContext.quadraticCurveTo(4, 8, 11, 3); drawContext.quadraticCurveTo(18, 10, 11, 17); drawContext.fill();
    drawContext.fillStyle = "#fff0b3";
    drawContext.beginPath(); drawContext.ellipse(11, 12, 2, 4, 0, 0, Math.PI * 2); drawContext.fill();
    drawContext.restore();
  }

  function drawBackground(drawContext, biome, time) {
    const colors = palette[biome];
    const skyGradient = drawContext.createLinearGradient(0, 0, 0, 540);
    skyGradient.addColorStop(0, colors.sky);
    skyGradient.addColorStop(1, colors.near);
    drawContext.fillStyle = skyGradient;
    drawContext.fillRect(0, 0, 960, 540);
    if (biome !== "castle") {
      drawContext.fillStyle = "rgba(245, 219, 153, .78)";
      drawContext.beginPath();
      drawContext.arc(775, 88, 34, 0, Math.PI * 2);
      drawContext.fill();
      drawContext.fillStyle = colors.sky;
      drawContext.beginPath();
      drawContext.arc(791, 75, 32, 0, Math.PI * 2);
      drawContext.fill();
      drawHill(drawContext, colors.far, 345, 42, 1.3);
      drawHill(drawContext, colors.near, 388, 31, 2.1);
      drawContext.fillStyle = colors.mist;
      drawContext.fillRect(0, 312 + Math.sin(time * 0.16) * 7, 960, 34);
    }
    drawLandmark(drawContext, biome, time);
    drawAmbientDetails(drawContext, biome, time);
    drawTrack(drawContext, colors, time);
  }

  function drawMenuBackground(drawContext) {
    const skyGradient = drawContext.createLinearGradient(0, 0, 0, 540);
    skyGradient.addColorStop(0, "#121d29");
    skyGradient.addColorStop(.62, "#283b3d");
    skyGradient.addColorStop(1, "#4b4c43");
    drawContext.fillStyle = skyGradient;
    drawContext.fillRect(0, 0, 960, 540);

    const stars = [[72, 76], [182, 122], [282, 58], [356, 145], [497, 79], [619, 129], [876, 72], [920, 156]];
    drawContext.fillStyle = "rgba(241, 225, 177, .75)";
    stars.forEach(function (star, index) {
      drawContext.beginPath();
      drawContext.arc(star[0], star[1], index % 3 === 0 ? 2 : 1.2, 0, Math.PI * 2);
      drawContext.fill();
    });

    drawContext.save();
    drawContext.shadowColor = "rgba(242, 220, 157, .5)";
    drawContext.shadowBlur = 32;
    drawContext.fillStyle = "#ead99e";
    drawContext.beginPath(); drawContext.arc(756, 108, 54, 0, Math.PI * 2); drawContext.fill();
    drawContext.restore();
    drawContext.fillStyle = "rgba(189, 171, 121, .16)";
    drawContext.beginPath(); drawContext.arc(738, 91, 7, 0, Math.PI * 2); drawContext.arc(776, 126, 5, 0, Math.PI * 2); drawContext.arc(765, 78, 3, 0, Math.PI * 2); drawContext.fill();

    drawHill(drawContext, "#263335", 344, 26, 1.4);
    drawHill(drawContext, "#303b38", 389, 18, 2.3);
    drawContext.fillStyle = "#202b2b";
    drawContext.fillRect(0, 388, 960, 152);

    drawContext.fillStyle = "#4a4e49";
    drawContext.fillRect(377, 306, 102, 136);
    drawContext.fillRect(433, 249, 304, 193);
    drawContext.fillRect(699, 265, 139, 177);
    drawContext.fillStyle = "#303638";
    drawContext.beginPath(); drawContext.moveTo(354, 311); drawContext.lineTo(426, 238); drawContext.lineTo(496, 311); drawContext.closePath(); drawContext.fill();
    drawContext.beginPath(); drawContext.moveTo(407, 266); drawContext.lineTo(582, 145); drawContext.lineTo(762, 266); drawContext.closePath(); drawContext.fill();
    drawContext.beginPath(); drawContext.moveTo(674, 281); drawContext.lineTo(768, 173); drawContext.lineTo(861, 281); drawContext.closePath(); drawContext.fill();
    drawContext.fillStyle = "#414344";
    drawContext.fillRect(423, 430, 428, 12);

    drawContext.strokeStyle = "#8e7958";
    drawContext.lineWidth = 5;
    drawContext.beginPath(); drawContext.moveTo(426, 265); drawContext.lineTo(582, 154); drawContext.lineTo(744, 265); drawContext.stroke();
    drawContext.beginPath(); drawContext.moveTo(690, 278); drawContext.lineTo(768, 187); drawContext.lineTo(846, 278); drawContext.stroke();
    drawContext.fillStyle = "#b98b54";
    drawContext.fillRect(533, 207, 5, 16);
    drawContext.fillRect(634, 207, 5, 16);

    [[458, 306], [518, 306], [654, 306], [722, 298], [786, 298]].forEach(function (windowPosition) {
      drawContext.fillStyle = "rgba(232, 174, 91, .22)";
      drawContext.fillRect(windowPosition[0] - 5, windowPosition[1] - 5, 42, 64);
      drawContext.fillStyle = "#d5a660";
      drawContext.fillRect(windowPosition[0], windowPosition[1], 32, 54);
      drawContext.fillStyle = "#f0c77b";
      drawContext.fillRect(windowPosition[0] + 4, windowPosition[1] + 4, 24, 46);
      drawContext.fillStyle = "#745d47";
      drawContext.fillRect(windowPosition[0] + 14, windowPosition[1], 4, 54);
      drawContext.fillRect(windowPosition[0], windowPosition[1] + 25, 32, 4);
    });

    drawContext.fillStyle = "#21292a";
    drawContext.beginPath(); drawContext.moveTo(574, 442); drawContext.lineTo(574, 365); drawContext.quadraticCurveTo(600, 329, 626, 365); drawContext.lineTo(626, 442); drawContext.closePath(); drawContext.fill();
    drawContext.strokeStyle = "#8d704e"; drawContext.lineWidth = 4;
    drawContext.beginPath(); drawContext.moveTo(574, 442); drawContext.lineTo(574, 365); drawContext.quadraticCurveTo(600, 329, 626, 365); drawContext.lineTo(626, 442); drawContext.stroke();
    drawContext.fillStyle = "#d2a15c"; drawContext.beginPath(); drawContext.arc(616, 399, 3, 0, Math.PI * 2); drawContext.fill();

    drawContext.fillStyle = "rgba(116, 105, 81, .52)";
    drawContext.beginPath(); drawContext.moveTo(574, 442); drawContext.lineTo(626, 442); drawContext.lineTo(742, 540); drawContext.lineTo(414, 540); drawContext.closePath(); drawContext.fill();
    drawContext.strokeStyle = "rgba(197, 174, 128, .24)";
    drawContext.lineWidth = 1.5;
    [472, 498, 522].forEach(function (stoneY) {
      const width = (stoneY - 442) * 1.4;
      drawContext.beginPath(); drawContext.moveTo(600 - width, stoneY); drawContext.lineTo(600 + width, stoneY); drawContext.stroke();
    });

    drawContext.strokeStyle = "#192323";
    drawContext.lineCap = "round";
    drawContext.lineWidth = 10;
    drawContext.beginPath(); drawContext.moveTo(890, 465); drawContext.bezierCurveTo(882, 387, 901, 316, 887, 224); drawContext.stroke();
    drawContext.lineWidth = 5;
    [[887, 344, 844, 329, 818, 286], [847, 329, 817, 324, 795, 301], [889, 316, 927, 281, 927, 232], [910, 298, 943, 289, 955, 264], [884, 279, 850, 252, 846, 214], [846, 252, 820, 242, 804, 220], [887, 257, 909, 227, 908, 194]].forEach(function (branch) {
      drawContext.beginPath(); drawContext.moveTo(branch[0], branch[1]); drawContext.quadraticCurveTo(branch[2], branch[3], branch[4], branch[5]); drawContext.stroke();
    });
    drawContext.lineWidth = 2;
    [[818, 286, 807, 268, 808, 251], [927, 232, 947, 220, 949, 202], [846, 214, 829, 194, 831, 177], [908, 194, 918, 178, 915, 163], [955, 264, 962, 247, 959, 235]].forEach(function (branch) {
      drawContext.beginPath(); drawContext.moveTo(branch[0], branch[1]); drawContext.quadraticCurveTo(branch[2], branch[3], branch[4], branch[5]); drawContext.stroke();
    });
    drawContext.lineCap = "butt";
  }

  function drawLandmark(drawContext, biome, time) {
    drawContext.save();
    drawContext.globalAlpha = .96;
    if (biome === "castle") {
      drawContext.fillStyle = "#403b38";
      drawContext.beginPath(); drawContext.moveTo(0, 0); drawContext.lineTo(355, 108); drawContext.lineTo(355, 366); drawContext.lineTo(0, 366); drawContext.closePath(); drawContext.fill();
      drawContext.beginPath(); drawContext.moveTo(960, 0); drawContext.lineTo(605, 108); drawContext.lineTo(605, 366); drawContext.lineTo(960, 366); drawContext.closePath(); drawContext.fill();
      const farWall = drawContext.createLinearGradient(355, 100, 605, 366);
      farWall.addColorStop(0, "#71604d"); farWall.addColorStop(1, "#51473d");
      drawContext.fillStyle = farWall; drawContext.fillRect(355, 108, 250, 258);
      drawContext.fillStyle = "#302e2d";
      drawContext.beginPath(); drawContext.moveTo(0, 0); drawContext.lineTo(960, 0); drawContext.lineTo(605, 108); drawContext.lineTo(355, 108); drawContext.closePath(); drawContext.fill();
      drawContext.strokeStyle = "rgba(225, 206, 163, .18)"; drawContext.lineWidth = 2;
      [163, 222, 281, 340].forEach(function (mortarY) {
        drawContext.beginPath(); drawContext.moveTo(0, mortarY); drawContext.lineTo(355, 142 + (mortarY - 163) * .52); drawContext.stroke();
        drawContext.beginPath(); drawContext.moveTo(960, mortarY); drawContext.lineTo(605, 142 + (mortarY - 163) * .52); drawContext.stroke();
      });
      drawContext.fillStyle = "#292f30";
      drawContext.beginPath(); drawContext.moveTo(389, 366); drawContext.lineTo(389, 219); drawContext.quadraticCurveTo(480, 117, 571, 219); drawContext.lineTo(571, 366); drawContext.closePath(); drawContext.fill();
      drawContext.strokeStyle = "#c5a56c"; drawContext.lineWidth = 8;
      drawContext.beginPath(); drawContext.moveTo(389, 366); drawContext.lineTo(389, 219); drawContext.quadraticCurveTo(480, 117, 571, 219); drawContext.lineTo(571, 366); drawContext.stroke();
      drawContext.fillStyle = "#76513a";
      roundRect(drawContext, 422, 201, 116, 100, 5); drawContext.fill();
      drawContext.strokeStyle = "#d0ad6c"; drawContext.lineWidth = 3; drawContext.strokeRect(422, 201, 116, 100);
      drawContext.fillStyle = "#2f4240";
      roundRect(drawContext, 443, 215, 74, 27, 10); drawContext.fill();
      drawContext.strokeStyle = "#c3a267"; drawContext.lineWidth = 2; drawContext.strokeRect(443, 215, 74, 27);
      drawContext.fillStyle = "#eed28e"; drawContext.beginPath(); drawContext.arc(480, 228, 6, 0, Math.PI * 2); drawContext.fill();
      drawContext.strokeStyle = "rgba(45, 35, 29, .7)"; drawContext.lineWidth = 3;
      drawContext.beginPath(); drawContext.moveTo(478, 252); drawContext.lineTo(478, 296); drawContext.moveTo(500, 252); drawContext.lineTo(500, 296); drawContext.stroke();
      drawContext.fillStyle = "#e4c47d"; drawContext.beginPath(); drawContext.arc(522, 263, 4, 0, Math.PI * 2); drawContext.fill();
      drawPortraitFrame(drawContext, 45, 151, 75, 99, "#66735d", "#393a32", "left");
      drawPortraitFrame(drawContext, 218, 210, 42, 60, "#745249", "#373330", "left");
      drawPortraitFrame(drawContext, 840, 151, 75, 99, "#586774", "#3a3036", "right");
      drawPortraitFrame(drawContext, 700, 210, 42, 60, "#715a46", "#302d2b", "right");
      drawWallSconce(drawContext, 153, 263, .9);
      drawWallSconce(drawContext, 796, 263, .9);
    } else if (biome === "forest") {
      drawContext.fillStyle = "#18382f";
      [90, 182, 276, 744, 842, 911].forEach(function (treeX, index) {
        drawContext.fillRect(treeX, 214 + (index % 2) * 24, 17, 150);
        drawContext.beginPath();
        drawContext.moveTo(treeX - 47, 274); drawContext.lineTo(treeX + 8, 155 + (index % 2) * 15); drawContext.lineTo(treeX + 61, 274); drawContext.fill();
      });
      drawContext.fillStyle = "#477451";
      drawContext.beginPath(); drawContext.arc(165, 212, 58, 0, Math.PI * 2); drawContext.arc(814, 219, 63, 0, Math.PI * 2); drawContext.fill();
    } else {
      drawContext.fillStyle = "#26383a";
      drawContext.fillRect(109, 284, 5, 78); drawContext.fillRect(238, 284, 5, 78); drawContext.fillRect(367, 284, 5, 78);
      [284, 313, 344].forEach(function (railY) { drawContext.fillRect(108, railY, 264, 5); });
      [157, 298, 718, 867].forEach(function (graveX, index) {
        drawContext.fillStyle = index % 2 === 0 ? "#879082" : "#aaa489";
        roundRect(drawContext, graveX, 267 + (index % 2) * 18, 36, 72, 18);
        drawContext.fill();
        drawContext.fillStyle = "#66716a";
        drawContext.fillRect(graveX + 16, 286 + (index % 2) * 18, 4, 20);
        drawContext.fillRect(graveX + 9, 293 + (index % 2) * 18, 18, 4);
      });
    }
    drawContext.restore();
  }

  function drawTrack(drawContext, colors, time) {
    drawContext.fillStyle = colors.ground;
    drawContext.fillRect(0, roadHorizonY, 960, roadNearY - roadHorizonY);
    drawContext.fillStyle = colors.track;
    drawContext.beginPath();
    drawContext.moveTo(255, roadHorizonY); drawContext.lineTo(705, roadHorizonY); drawContext.lineTo(925, roadNearY); drawContext.lineTo(35, roadNearY); drawContext.closePath(); drawContext.fill();
    drawContext.strokeStyle = "rgba(238, 232, 208, .34)";
    drawContext.lineWidth = 2;
    [1, 2].forEach(function (boundary) {
      const farX = 255 + 450 * boundary / 3;
      const nearX = 35 + 890 * boundary / 3;
      drawContext.setLineDash([15, 17]);
      drawContext.lineDashOffset = -time * state.speed * .05;
      drawContext.beginPath();
      drawContext.moveTo(farX, roadHorizonY);
      drawContext.lineTo(nearX, roadNearY);
      drawContext.stroke();
    });
    drawContext.setLineDash([]);
    drawContext.fillStyle = colors.accent;
    drawContext.globalAlpha = .42;
    drawContext.fillRect(0, roadHorizonY - 4, 960, 5);
    drawContext.globalAlpha = 1;
  }

  function drawCharacterBody(drawContext, characterId, bodyColor) {
    drawContext.fillStyle = bodyColor;
    drawContext.beginPath();
    if (characterId === "witch") {
      drawContext.moveTo(-15, -53); drawContext.quadraticCurveTo(0, -60, 15, -53); drawContext.lineTo(19, -23); drawContext.lineTo(30, 0); drawContext.quadraticCurveTo(0, 8, -30, 0); drawContext.lineTo(-19, -23); drawContext.closePath();
    } else if (characterId === "ghost") {
      drawContext.moveTo(-18, -52); drawContext.quadraticCurveTo(0, -62, 18, -52); drawContext.lineTo(22, -12); drawContext.quadraticCurveTo(18, -3, 11, -11); drawContext.quadraticCurveTo(4, -1, 0, -9); drawContext.quadraticCurveTo(-8, 0, -13, -10); drawContext.quadraticCurveTo(-21, -3, -22, -12); drawContext.closePath();
    } else if (characterId === "vampire") {
      drawContext.moveTo(-14, -54); drawContext.lineTo(14, -54); drawContext.lineTo(19, -25); drawContext.lineTo(34, 0); drawContext.lineTo(15, -8); drawContext.lineTo(0, 4); drawContext.lineTo(-15, -8); drawContext.lineTo(-34, 0); drawContext.lineTo(-19, -25); drawContext.closePath();
    } else if (characterId === "werewolf") {
      drawContext.moveTo(-18, -52); drawContext.lineTo(-28, -43); drawContext.lineTo(-21, -34); drawContext.lineTo(-30, -23); drawContext.lineTo(-20, -12); drawContext.lineTo(-24, 0); drawContext.lineTo(24, 0); drawContext.lineTo(20, -12); drawContext.lineTo(30, -23); drawContext.lineTo(21, -34); drawContext.lineTo(28, -43); drawContext.lineTo(18, -52); drawContext.closePath();
    } else {
      drawContext.moveTo(-16, -51); drawContext.lineTo(16, -51); drawContext.lineTo(19, -34); drawContext.lineTo(12, -20); drawContext.lineTo(16, 0); drawContext.lineTo(-16, 0); drawContext.lineTo(-12, -20); drawContext.lineTo(-19, -34); drawContext.closePath();
    }
    drawContext.fill();
    if (characterId === "witch") {
      drawContext.strokeStyle = "#f3c56d"; drawContext.lineWidth = 3;
      drawContext.beginPath(); drawContext.moveTo(-19, -18); drawContext.quadraticCurveTo(0, -11, 19, -18); drawContext.stroke();
      drawContext.fillStyle = "#f3d17b"; drawContext.beginPath(); drawContext.arc(0, -15, 3, 0, Math.PI * 2); drawContext.fill();
    } else if (characterId === "ghost") {
      drawContext.strokeStyle = "rgba(255, 255, 239, .62)"; drawContext.lineWidth = 2;
      drawContext.beginPath(); drawContext.moveTo(-12, -35); drawContext.quadraticCurveTo(-2, -29, 9, -35); drawContext.moveTo(-10, -27); drawContext.quadraticCurveTo(0, -21, 11, -27); drawContext.stroke();
    } else if (characterId === "vampire") {
      drawContext.fillStyle = "#edc16e"; drawContext.beginPath(); drawContext.moveTo(-6, -46); drawContext.lineTo(0, -39); drawContext.lineTo(6, -46); drawContext.lineTo(0, -30); drawContext.closePath(); drawContext.fill();
      drawContext.strokeStyle = "rgba(238, 199, 154, .55)"; drawContext.lineWidth = 2; drawContext.beginPath(); drawContext.moveTo(-20, -19); drawContext.lineTo(-9, -3); drawContext.moveTo(20, -19); drawContext.lineTo(9, -3); drawContext.stroke();
    } else if (characterId === "werewolf") {
      drawContext.strokeStyle = "#d5c892"; drawContext.lineWidth = 3; drawContext.lineCap = "round";
      drawContext.beginPath(); drawContext.moveTo(-23, -27); drawContext.lineTo(-31, -18); drawContext.moveTo(23, -27); drawContext.lineTo(31, -18); drawContext.stroke();
    } else {
      drawContext.strokeStyle = "#f2ead4"; drawContext.lineWidth = 3; drawContext.lineCap = "round";
      [-39, -31, -23].forEach(function (ribY) {
        drawContext.beginPath(); drawContext.moveTo(-13, ribY); drawContext.quadraticCurveTo(0, ribY + 7, 13, ribY); drawContext.stroke();
      });
      drawContext.beginPath(); drawContext.moveTo(-23, -14); drawContext.lineTo(-30, -5); drawContext.moveTo(23, -14); drawContext.lineTo(30, -5); drawContext.stroke();
    }
  }

  function drawCharacterHead(drawContext, characterId, skinColor) {
    if (characterId === "skeleton") {
      drawContext.fillStyle = "#e9e1c9";
      drawContext.beginPath();
      drawContext.moveTo(-18, -69); drawContext.quadraticCurveTo(-18, -86, 0, -86); drawContext.quadraticCurveTo(18, -86, 18, -69);
      drawContext.lineTo(16, -52); drawContext.lineTo(10, -43); drawContext.lineTo(-10, -43); drawContext.lineTo(-16, -52); drawContext.closePath(); drawContext.fill();
      drawContext.fillStyle = "#293a36";
      drawContext.beginPath(); drawContext.ellipse(-7, -65, 4.5, 6, 0, 0, Math.PI * 2); drawContext.ellipse(7, -65, 4.5, 6, 0, 0, Math.PI * 2); drawContext.fill();
      drawContext.beginPath(); drawContext.moveTo(-3, -57); drawContext.lineTo(3, -57); drawContext.lineTo(0, -52); drawContext.closePath(); drawContext.fill();
      roundRect(drawContext, -10, -51, 20, 7, 2); drawContext.fill();
      drawContext.fillStyle = "#e9e1c9";
      [-6, 0, 6].forEach(function (toothX) { drawContext.fillRect(toothX - 1, -50, 2, 5); });
      drawContext.strokeStyle = "#8e8b7a"; drawContext.lineWidth = 1.5;
      drawContext.beginPath(); drawContext.moveTo(12, -79); drawContext.lineTo(7, -73); drawContext.lineTo(13, -69); drawContext.stroke();
    } else if (characterId === "werewolf") {
      drawContext.fillStyle = skinColor;
      drawContext.beginPath(); drawContext.ellipse(0, -64, 20, 22, 0, 0, Math.PI * 2); drawContext.fill();
      drawContext.fillStyle = "#d8c99e";
      drawContext.beginPath(); drawContext.ellipse(0, -52, 12, 8, 0, 0, Math.PI * 2); drawContext.fill();
      drawContext.fillStyle = "#293b35";
      drawContext.beginPath(); drawContext.moveTo(-5, -55); drawContext.lineTo(5, -55); drawContext.lineTo(0, -50); drawContext.closePath(); drawContext.fill();
      roundRect(drawContext, -9, -49, 18, 7, 3); drawContext.fill();
      drawContext.fillStyle = "#fff0d8";
      drawContext.beginPath(); drawContext.moveTo(-7, -49); drawContext.lineTo(-5, -43); drawContext.lineTo(-2, -49); drawContext.moveTo(2, -49); drawContext.lineTo(5, -43); drawContext.lineTo(7, -49); drawContext.fill();
      drawContext.fillStyle = "#d7c987";
      drawContext.beginPath(); drawContext.ellipse(-7, -65, 3.5, 2.5, 0, 0, Math.PI * 2); drawContext.ellipse(7, -65, 3.5, 2.5, 0, 0, Math.PI * 2); drawContext.fill();
      drawContext.fillStyle = "#283a34";
      drawContext.beginPath(); drawContext.arc(-7, -65, 1.5, 0, Math.PI * 2); drawContext.arc(7, -65, 1.5, 0, Math.PI * 2); drawContext.fill();
    } else {
      drawContext.fillStyle = skinColor;
      drawContext.beginPath(); drawContext.ellipse(0, -64, 20, 22, 0, 0, Math.PI * 2); drawContext.fill();
      drawContext.fillStyle = "#263b35";
      drawContext.beginPath(); drawContext.ellipse(-7, -64, 2.7, 4, 0, 0, Math.PI * 2); drawContext.ellipse(7, -64, 2.7, 4, 0, 0, Math.PI * 2); drawContext.fill();
      if (characterId === "vampire") {
        drawContext.strokeStyle = "#263b35"; drawContext.lineWidth = 2;
        drawContext.beginPath(); drawContext.moveTo(-9, -52); drawContext.lineTo(9, -52); drawContext.stroke();
        drawContext.fillStyle = "#fff0d8";
        drawContext.beginPath(); drawContext.moveTo(-8, -53); drawContext.lineTo(-5, -46); drawContext.lineTo(-2, -53); drawContext.moveTo(2, -53); drawContext.lineTo(5, -46); drawContext.lineTo(8, -53); drawContext.fill();
      } else {
        drawContext.strokeStyle = "#263b35"; drawContext.lineWidth = 2;
        drawContext.beginPath(); drawContext.arc(0, -57, 5, .2, Math.PI - .2); drawContext.stroke();
      }
    }
  }

  function drawCharacter(drawContext, characterId, x, y, time, active) {
    const character = getCharacter(characterId);
    drawContext.save();
    drawContext.translate(x, y + Math.sin(time * 11) * 2);
    if (active && characterId === "ghost") {
      drawContext.globalAlpha = .58 + Math.sin(time * 25) * .16;
      drawContext.shadowBlur = 22;
      drawContext.shadowColor = "#edf0dd";
    }
    if (active && characterId === "witch") {
      drawContext.strokeStyle = "rgba(240, 197, 110, 0.9)";
      drawContext.lineWidth = 2.2;
      drawContext.shadowBlur = 14;
      drawContext.shadowColor = "#f7d77c";
      drawContext.beginPath(); drawContext.arc(0, -46, 38, 0, Math.PI * 2); drawContext.stroke();
      drawContext.shadowBlur = 0;
    }
    if (active && characterId === "vampire") {
      drawContext.strokeStyle = "rgba(12, 12, 12, .9)";
      drawContext.lineWidth = 2;
      drawContext.shadowBlur = 18;
      drawContext.shadowColor = "#000000";
      for (let batIndex = 0; batIndex < 8; batIndex += 1) {
        const angle = time * 2 + batIndex * 0.9;
        const batX = Math.cos(angle) * 46;
        const batY = -41 + Math.sin(angle * 1.7) * 26;
        drawContext.beginPath();
        drawContext.moveTo(batX, batY);
        drawContext.lineTo(batX - 10, batY - 6);
        drawContext.lineTo(batX - 5, batY + 7);
        drawContext.lineTo(batX + 10, batY + 5);
        drawContext.lineTo(batX, batY);
        drawContext.fillStyle = "#090909";
        drawContext.fill();
      }
      drawContext.shadowBlur = 0;
    }
    if (active && characterId === "werewolf") {
      drawContext.strokeStyle = "rgba(240, 209, 117, 0.9)";
      drawContext.lineWidth = 2.8;
      drawContext.shadowBlur = 10;
      drawContext.shadowColor = "#f2c86b";
      drawContext.beginPath(); drawContext.moveTo(-26, 11); drawContext.quadraticCurveTo(0, -4, 26, 11); drawContext.stroke();
      drawContext.shadowBlur = 0;
    }
    if (active && characterId === "skeleton") {
      drawContext.strokeStyle = "#f4eace";
      drawContext.lineWidth = 4;
      drawContext.shadowBlur = 16;
      drawContext.shadowColor = "#f4eace";
      drawContext.beginPath(); drawContext.arc(0, -46, 48, 0, Math.PI * 2); drawContext.stroke();
      drawContext.shadowBlur = 0;
      drawContext.fillStyle = "#f4eace";
      drawContext.fillRect(-18, -68, 36, 5);
    }
    drawContext.fillStyle = "rgba(15, 29, 27, .25)";
    drawContext.beginPath(); drawContext.ellipse(0, 5, 30, 8, 0, 0, Math.PI * 2); drawContext.fill();
    drawCharacterBody(drawContext, characterId, character.color);
    drawCharacterHead(drawContext, characterId, character.secondary);
    if (characterId === "witch") {
      drawContext.fillStyle = "#263b35";
      drawContext.beginPath(); drawContext.moveTo(-23, -81); drawContext.lineTo(0, -124); drawContext.lineTo(23, -81); drawContext.closePath(); drawContext.fill();
      drawContext.fillRect(-31, -85, 62, 7);
      drawContext.fillStyle = "#e8ab58"; drawContext.fillRect(-19, -89, 38, 4);
    } else if (characterId === "ghost") {
      drawContext.fillStyle = "#f2eedf"; drawContext.beginPath(); drawContext.arc(0, -89, 5, 0, Math.PI * 2); drawContext.fill();
    } else if (characterId === "vampire") {
      drawContext.fillStyle = "#922f40";
      drawContext.beginPath();
      drawContext.moveTo(-18, -42);
      drawContext.quadraticCurveTo(-35, -12, -38, 10);
      drawContext.quadraticCurveTo(-22, 20, -6, 18);
      drawContext.lineTo(0, -8);
      drawContext.lineTo(6, 18);
      drawContext.quadraticCurveTo(22, 20, 38, 10);
      drawContext.quadraticCurveTo(35, -12, 18, -42);
      drawContext.closePath();
      drawContext.fill();
    } else if (characterId === "werewolf") {
      drawContext.fillStyle = "#788654"; drawContext.beginPath(); drawContext.moveTo(-17, -77); drawContext.lineTo(-25, -99); drawContext.lineTo(-5, -83); drawContext.moveTo(17, -77); drawContext.lineTo(25, -99); drawContext.lineTo(5, -83); drawContext.fill();
    } else {
      drawContext.strokeStyle = "#e8dfbc"; drawContext.lineWidth = 3;
      drawContext.beginPath(); drawContext.moveTo(-10, -46); drawContext.lineTo(-15, -29); drawContext.lineTo(-7, -13); drawContext.moveTo(10, -46); drawContext.lineTo(15, -29); drawContext.lineTo(7, -13); drawContext.stroke();
    }
    if (active && characterId === "witch") {
      drawContext.strokeStyle = "#f0c56e"; drawContext.lineWidth = 3; drawContext.beginPath(); drawContext.arc(0, -46, 39, 0, Math.PI * 2); drawContext.stroke();
    }
    drawContext.restore();
  }

  function drawObstacle(drawContext, obstacle, biome, time) {
    const lanePosition = laneX(obstacle.lane, obstacle.y);
    const depthScale = Math.max(.45, Math.min(1.15, (obstacle.y - 195) / 215));
    const sizeScale = canJumpObstacle(obstacle.kind) ? 1 : 1.25;
    const scale = depthScale * sizeScale;
    const height = 58;
    drawContext.save();
    drawContext.translate(lanePosition, obstacle.y);
    drawContext.scale(scale, scale);
    if (obstacle.kind === "gap") {
      drawContext.fillStyle = "#192725";
      drawContext.beginPath(); drawContext.moveTo(-56, 3); drawContext.lineTo(-43, -3); drawContext.lineTo(-31, 2); drawContext.lineTo(-15, -4); drawContext.lineTo(1, 1); drawContext.lineTo(18, -5); drawContext.lineTo(36, 1); drawContext.lineTo(52, -3); drawContext.lineTo(57, 10); drawContext.quadraticCurveTo(0, 30, -57, 10); drawContext.closePath(); drawContext.fill();
      drawContext.strokeStyle = palette[biome].accent; drawContext.lineWidth = 3;
      drawContext.beginPath(); drawContext.moveTo(-55, 3); drawContext.lineTo(-43, -3); drawContext.lineTo(-31, 2); drawContext.lineTo(-15, -4); drawContext.lineTo(1, 1); drawContext.lineTo(18, -5); drawContext.lineTo(36, 1); drawContext.lineTo(52, -3); drawContext.stroke();
      drawContext.strokeStyle = "rgba(25, 39, 37, .8)"; drawContext.lineWidth = 2;
      drawContext.beginPath(); drawContext.moveTo(-25, -2); drawContext.lineTo(-32, -15); drawContext.moveTo(16, -3); drawContext.lineTo(23, -14); drawContext.stroke();
    } else if (obstacle.kind === "overhead") {
      drawContext.fillStyle = biome === "forest" ? "#553b2e" : "#3b4742";
      roundRect(drawContext, -35, -18, 70, 20, 8); drawContext.fill();
      drawContext.fillStyle = "#e3c378"; drawContext.fillRect(-22, -17, 5, 4); drawContext.fillRect(17, -17, 5, 4);
    } else if (biome === "castle") {
      if (obstacle.kind === "armor") {
        drawContext.fillStyle = "#aeb9ad";
        drawContext.fillRect(-14, -20, 9, 20); drawContext.fillRect(5, -20, 9, 20);
        drawContext.fillStyle = "#555f58";
        drawContext.fillRect(-17, -4, 13, 5); drawContext.fillRect(4, -4, 13, 5);
        drawContext.fillStyle = "#c2c8b5";
        drawContext.beginPath(); drawContext.moveTo(-18, -48); drawContext.lineTo(-12, -56); drawContext.lineTo(12, -56); drawContext.lineTo(18, -48); drawContext.lineTo(13, -24); drawContext.lineTo(0, -18); drawContext.lineTo(-13, -24); drawContext.closePath(); drawContext.fill();
        drawContext.fillStyle = "#7c897e";
        drawContext.beginPath(); drawContext.arc(-15, -45, 8, 0, Math.PI * 2); drawContext.arc(15, -45, 8, 0, Math.PI * 2); drawContext.fill();
        drawContext.fillStyle = "#d7d9c8";
        drawContext.beginPath(); drawContext.arc(0, -67, 14, Math.PI, Math.PI * 2); drawContext.lineTo(12, -53); drawContext.lineTo(-12, -53); drawContext.closePath(); drawContext.fill();
        drawContext.fillStyle = "#48544f"; drawContext.fillRect(-9, -60, 18, 5);
        drawContext.fillStyle = "#a34f47";
        drawContext.beginPath(); drawContext.moveTo(-25, -35); drawContext.lineTo(-18, -49); drawContext.lineTo(-11, -35); drawContext.lineTo(-15, -18); drawContext.lineTo(-23, -20); drawContext.closePath(); drawContext.fill();
        drawContext.strokeStyle = "#ded4b6"; drawContext.lineWidth = 3; drawContext.beginPath(); drawContext.moveTo(24, -60); drawContext.lineTo(24, -10); drawContext.stroke();
      } else {
        drawContext.fillStyle = "#918873";
        roundRect(drawContext, -31, -48, 62, 48, 4); drawContext.fill();
        drawContext.strokeStyle = "#c2b390"; drawContext.lineWidth = 2; drawContext.strokeRect(-31, -48, 62, 48);
        drawContext.strokeStyle = "rgba(47, 52, 47, .65)"; drawContext.lineWidth = 2;
        drawContext.beginPath(); drawContext.moveTo(-31, -30); drawContext.lineTo(31, -30); drawContext.moveTo(-8, -48); drawContext.lineTo(-8, -30); drawContext.moveTo(15, -30); drawContext.lineTo(15, 0); drawContext.moveTo(-22, -30); drawContext.lineTo(-22, 0); drawContext.stroke();
        drawContext.fillStyle = "#665e4f"; drawContext.fillRect(-21, -39, 7, 4); drawContext.fillRect(3, -20, 8, 5);
      }
    } else if (biome === "forest") {
      if (obstacle.kind === "log") {
        drawContext.fillStyle = "#80523a"; roundRect(drawContext, -36, -31, 72, 28, 13); drawContext.fill();
        drawContext.fillStyle = "#b37a4f"; drawContext.beginPath(); drawContext.ellipse(-33, -17, 8, 13, 0, 0, Math.PI * 2); drawContext.fill();
        drawContext.strokeStyle = "#65432f"; drawContext.lineWidth = 2; drawContext.beginPath(); drawContext.ellipse(-33, -17, 4, 8, 0, 0, Math.PI * 2); drawContext.moveTo(-18, -29); drawContext.quadraticCurveTo(-7, -17, -15, -4); drawContext.moveTo(10, -30); drawContext.quadraticCurveTo(19, -17, 12, -4); drawContext.stroke();
      } else {
        drawContext.fillStyle = "#5e7046"; drawContext.beginPath(); drawContext.ellipse(0, -13, 32, 14, 0, 0, Math.PI * 2); drawContext.fill();
        drawContext.strokeStyle = "#74533a"; drawContext.lineWidth = 9; drawContext.lineCap = "round";
        drawContext.beginPath(); drawContext.moveTo(0, -8); drawContext.quadraticCurveTo(-7, -28, -28, -31); drawContext.moveTo(-4, -9); drawContext.quadraticCurveTo(7, -29, 27, -38); drawContext.moveTo(7, -8); drawContext.quadraticCurveTo(12, -22, 10, -36); drawContext.stroke();
        drawContext.strokeStyle = "#a2774a"; drawContext.lineWidth = 2; drawContext.beginPath(); drawContext.moveTo(-28, -31); drawContext.lineTo(-35, -39); drawContext.moveTo(27, -38); drawContext.lineTo(34, -45); drawContext.stroke();
      }
    } else {
      if (obstacle.kind === "gate") {
        drawContext.fillStyle = "#596a5c";
        [-26, -13, 0, 13, 26].forEach(function (barX) {
          drawContext.fillRect(barX - 2, -56, 4, 56);
          drawContext.beginPath(); drawContext.moveTo(barX - 5, -54); drawContext.lineTo(barX, -65); drawContext.lineTo(barX + 5, -54); drawContext.closePath(); drawContext.fill();
        });
        drawContext.fillRect(-31, -38, 62, 5); drawContext.fillRect(-31, -12, 62, 5);
      } else {
        drawContext.fillStyle = "#aaa48f";
        drawContext.beginPath(); drawContext.moveTo(-24, 0); drawContext.lineTo(-24, -42); drawContext.quadraticCurveTo(-24, -65, 0, -65); drawContext.quadraticCurveTo(24, -65, 24, -42); drawContext.lineTo(24, 0); drawContext.closePath(); drawContext.fill();
        drawContext.strokeStyle = "#d1c5a6"; drawContext.lineWidth = 2; drawContext.stroke();
        drawContext.fillStyle = "#65695f"; drawContext.fillRect(-2, -48, 4, 23); drawContext.fillRect(-10, -41, 20, 4);
        drawContext.strokeStyle = "#74796e"; drawContext.beginPath(); drawContext.moveTo(14, -58); drawContext.lineTo(8, -52); drawContext.lineTo(13, -45); drawContext.stroke();
      }
    }
    if (obstacle.warning) {
      drawContext.globalAlpha = .7 + Math.sin(time * 18) * .2;
      drawContext.strokeStyle = "#f0c56e"; drawContext.lineWidth = 2;
      drawContext.beginPath(); drawContext.arc(0, -height - 25, 7, 0, Math.PI * 2); drawContext.stroke();
    }
    drawContext.restore();
  }

  function drawCrystal(drawContext, crystal, time) {
    drawContext.save();
    drawContext.translate(laneX(crystal.lane, crystal.y), crystal.y + Math.sin(time * 6 + crystal.phase) * 5);
    drawContext.shadowBlur = 17;
    drawContext.shadowColor = "#f0d47b";
    drawContext.fillStyle = "#f5d878";
    drawContext.beginPath(); drawContext.moveTo(0, -13); drawContext.lineTo(10, 0); drawContext.lineTo(0, 13); drawContext.lineTo(-10, 0); drawContext.closePath(); drawContext.fill();
    drawContext.fillStyle = "rgba(255, 255, 230, .8)";
    drawContext.beginPath(); drawContext.moveTo(0, -8); drawContext.lineTo(4, 0); drawContext.lineTo(0, 6); drawContext.closePath(); drawContext.fill();
    drawContext.restore();
  }

  function drawScene(time) {
    const biome = getBiome(state.distance);
    drawBackground(context, biome, time);
    state.obstacles.forEach(function (obstacle) { drawObstacle(context, obstacle, biome, time); });
    state.crystals.forEach(function (crystal) { drawCrystal(context, crystal, time); });
    const groundY = 433 - state.jumpHeight;
    drawCharacter(context, state.characterId, laneX(state.lane), groundY, time, state.abilityTime > 0);
    state.particles.forEach(function (particle) {
      context.globalAlpha = Math.max(0, particle.life / particle.maxLife);
      context.fillStyle = particle.color;
      context.beginPath(); context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2); context.fill();
    });
    context.globalAlpha = 1;
    if (state.boneActive) {
      context.fillStyle = "#eee6d3";
      context.save(); context.translate(laneX(state.lane) + 40, 366); context.rotate(time * 13);
      context.fillRect(-12, -3, 24, 6); context.beginPath(); context.arc(-11, -4, 5, 0, Math.PI * 2); context.arc(11, 4, 5, 0, Math.PI * 2); context.fill(); context.restore();
    }
  }

  function createStateForRun() {
    state = createState(selectedCharacter);
    state.phase = "running";
    state.speed = 250;
    state.previousBiome = "castle";
    obstacleTimer = 1.35;
    crystalTimer = 2.1;
    if (recordsState.persistent) {
      recordsState = storageRead();
    }
    menuScreen.hidden = true;
    pauseScreen.hidden = true;
    resultScreen.hidden = true;
    canvas.closest(".game-frame").classList.add("is-playing");
    hud.hidden = false;
    touchControls.hidden = false;
    lastFrameTime = performance.now();
    if (animationFrame) {
      window.cancelAnimationFrame(animationFrame);
    }
    animationFrame = window.requestAnimationFrame(gameLoop);
    canvas.focus();
  }

  function setSelection(characterId) {
    selectedCharacter = getCharacter(characterId).id;
    characterButtons.forEach(function (button) {
      const selected = button.dataset.character === selectedCharacter;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
    document.getElementById("selectedPower").textContent = powerDescriptions[selectedCharacter];
    const personalRecord = recordsState.value.byCharacter[selectedCharacter] || 0;
    document.getElementById("menuRecord").textContent = String(personalRecord) + " m";
  }

  function updateHud() {
    const character = getCharacter(state.characterId);
    const distance = Math.floor(state.distance);
    const biome = getBiome(state.distance);
    const personalRecord = recordsState.value.byCharacter[state.characterId] || 0;
    document.getElementById("distanceValue").innerHTML = String(distance) + " <small>m</small>";
    document.getElementById("zoneName").textContent = biomeNames[biome];
    document.getElementById("obstacleHint").textContent = obstacleDescriptions[biome];
    document.getElementById("powerName").textContent = character.power;
    document.getElementById("topRecord").textContent = String(recordsState.value.overall) + " m";
    document.getElementById("powerIcon").textContent = state.cooldown <= 0 ? "✦" : "◌";
    if (state.abilityTime > 0) {
      document.getElementById("cooldownText").textContent = "ACTIVO · " + character.power.toUpperCase();
      document.getElementById("cooldownBar").style.transform = "scaleX(" + String(Math.max(0, 1 - state.abilityTime / abilityDuration)) + ")";
    } else {
      const cooldownLabel = state.cooldown <= 0 ? "LISTO · " + String(personalRecord) + " M RÉCORD" : "RECARGA " + state.cooldown.toFixed(1) + " S";
      document.getElementById("cooldownText").textContent = cooldownLabel;
      document.getElementById("cooldownBar").style.transform = "scaleX(" + String(1 - state.cooldown / baseCooldown) + ")";
    }
    document.getElementById("skillButton").disabled = state.cooldown > 0;
  }

  function spawnObstacle() {
    const biome = getBiome(state.distance);
    const kinds = obstacleNames[biome];
    const kindIndex = Math.floor(Math.random() * kinds.length);
    const lane = Math.floor(Math.random() * laneCount);
    const obstacle = { id: Math.random(), lane: lane, kind: kinds[kindIndex], y: roadHorizonY, warning: true, passed: false };
    state.obstacles.push(obstacle);
    if (Math.random() > .62) {
      const secondLane = (lane + 1 + Math.floor(Math.random() * 2)) % laneCount;
      const secondObstacle = { id: Math.random(), lane: secondLane, kind: kinds[Math.floor(Math.random() * kinds.length)], y: roadHorizonY, warning: true, passed: false };
      state.obstacles.push(secondObstacle);
    }
  }

  function spawnCrystal() {
    const crystal = { lane: Math.floor(Math.random() * laneCount), y: roadHorizonY, phase: Math.random() * 8, collected: false };
    state.crystals.push(crystal);
  }

  function createParticles(x, y, color, count) {
    for (let particleIndex = 0; particleIndex < count; particleIndex += 1) {
      const particle = {
        x: x, y: y, velocityX: (Math.random() - .5) * 150, velocityY: -Math.random() * 120,
        life: .45 + Math.random() * .3, maxLife: .75, size: 2 + Math.random() * 3, color: color
      };
      state.particles.push(particle);
    }
  }

  function obstacleCollision(obstacle) {
    const sameLane = obstacle.lane === state.lane;
    const atPlayer = obstacle.y > 390 && obstacle.y < 455;
    let collision = sameLane && atPlayer;
    if (collision && state.characterId === "vampire" && state.abilityTime > 0 && state.shieldAvailable) {
      state.shieldAvailable = false;
      state.abilityTime = 0;
      state.invulnerableTime = .18;
      state.obstacles = state.obstacles.filter(function (obstacleItem) { return obstacleItem.id !== obstacle.id; });
      document.getElementById("gameAnnouncement").textContent = "Escudo absorbido: el primer impacto fue bloqueado.";
      collision = false;
      createParticles(laneX(state.lane, 411), 411, "#f0c56e", 10);
      return collision;
    }
    if (collision && isObstacleAvoided(state.characterId, obstacle.kind, state.jumpHeight, state.abilityTime > 0, state.shieldAvailable)) {
      if (state.characterId === "ghost" && state.abilityTime > 0) {
        document.getElementById("gameAnnouncement").textContent = "Fase activa: has atravesado el obstáculo.";
      } else if (state.characterId === "witch" && state.abilityTime > 0) {
        document.getElementById("gameAnnouncement").textContent = "Vuelo activo: has pasado por encima del obstáculo.";
      } else if (state.characterId === "werewolf" && state.abilityTime > 0) {
        document.getElementById("gameAnnouncement").textContent = "Salto largo activo: superaste el obstáculo.";
      } else if (state.characterId === "skeleton" && state.boneActive) {
        document.getElementById("gameAnnouncement").textContent = "Bumerán activo: has roto el obstáculo.";
      }
      collision = false;
      createParticles(laneX(state.lane, 411), 411, "#f0c56e", 10);
    }
    return collision;
  }

  function breakObstacleWithBone() {
    let brokenIndex = -1;
    if (state.boneActive) {
      state.obstacles.forEach(function (obstacle, obstacleIndex) {
        if (brokenIndex < 0 && canBreakObstacle(state.characterId, state.boneActive, obstacle.lane === state.lane) && obstacle.y > 330 && obstacle.y < 440) {
          brokenIndex = obstacleIndex;
        }
      });
      if (brokenIndex >= 0) {
        const broken = state.obstacles.splice(brokenIndex, 1)[0];
        createParticles(laneX(broken.lane, broken.y), broken.y, "#e9e1c9", 15);
        state.boneActive = false;
      }
    }
  }

  function finishRun() {
    state.phase = "over";
    const distance = Math.floor(state.distance);
    const newRecords = updateRecord(recordsState.value, state.characterId, distance);
    let newOverallRecord = false;
    let newCharacterRecord = false;
    if (newRecords.ok) {
      newOverallRecord = distance > recordsState.value.overall;
      newCharacterRecord = distance > (recordsState.value.byCharacter[state.characterId] || 0);
      recordsState = { ok: true, value: newRecords.value, persistent: recordsState.persistent };
      const stored = storageWrite(newRecords.value);
      recordsState.persistent = stored.ok;
    }
    document.getElementById("resultDistance").innerHTML = String(distance) + " <small>m</small>";
    document.getElementById("resultRecord").textContent = String(recordsState.value.byCharacter[state.characterId] || 0) + " m";
    document.getElementById("newRecord").hidden = !(newOverallRecord || newCharacterRecord);
    document.getElementById("resultTitle").textContent = newOverallRecord || newCharacterRecord ? "¡Nuevo récord!" : "¡Casi lo logras!";
    document.getElementById("topRecord").textContent = String(recordsState.value.overall) + " m";
    document.getElementById("gameAnnouncement").textContent = "Carrera terminada. Distancia: " + String(distance) + " metros.";
    resultScreen.hidden = false;
    hud.hidden = true;
    touchControls.hidden = true;
    if (!recordsState.persistent) {
      const notice = document.getElementById("storageNotice");
      notice.textContent = "El navegador no permite guardar el récord en este archivo; solo estará disponible durante esta sesión.";
      notice.hidden = false;
    }
    canvas.focus();
  }

  function activateAbility() {
    let activated = false;
    if (state.phase === "running" && state.cooldown <= 0) {
      const characterId = state.characterId;
      state.cooldown = baseCooldown;
      state.abilityTime = abilityDuration;
      state.shieldAvailable = characterId === "vampire";
      if (characterId === "werewolf") {
        state.jumpVelocity = getJumpVelocity(characterId, true);
      }
      if (characterId === "skeleton") {
        state.boneActive = true;
      }
      if (characterId === "ghost") {
        document.getElementById("gameAnnouncement").textContent = "Fase activa: atraviesas obstáculos durante 1,5 s.";
      } else if (characterId === "witch") {
        document.getElementById("gameAnnouncement").textContent = "Vuelo activo: vuelas sobre trampas del suelo.";
      } else if (characterId === "vampire") {
        document.getElementById("gameAnnouncement").textContent = "Escudo activo: bloquea el primer impacto.";
      } else if (characterId === "werewolf") {
        document.getElementById("gameAnnouncement").textContent = "Salto largo activo: puedes sortear huecos y bloques altos.";
      } else if (characterId === "skeleton") {
        document.getElementById("gameAnnouncement").textContent = "Bumerán activo: rompe el primer obstáculo cercano.";
      } else {
        document.getElementById("gameAnnouncement").textContent = getCharacter(characterId).power + " activado.";
      }
      activated = true;
    }
    return activated;
  }

  function jump() {
    let jumped = false;
    if (state.phase === "running" && state.jumpHeight <= 0) {
      state.jumpVelocity = getJumpVelocity(state.characterId, state.abilityTime > 0);
      jumped = true;
    }
    return jumped;
  }

  function move(direction) {
    if (state.phase === "running") {
      state.lane = moveLane(state.lane, direction);
    }
  }

  function update(deltaSeconds) {
    if (state.phase === "running") {
      state.elapsed += deltaSeconds;
      state.speed = Math.min(465, 250 + state.distance * .075);
      state.distance += state.speed * deltaSeconds / 10;
      state.cooldown = Math.max(0, state.cooldown - deltaSeconds);
      state.abilityTime = Math.max(0, state.abilityTime - deltaSeconds);
      state.invulnerableTime = Math.max(0, state.invulnerableTime - deltaSeconds);
      if (state.jumpHeight > 0 || state.jumpVelocity > 0) {
        state.jumpHeight = Math.max(0, state.jumpHeight + state.jumpVelocity * deltaSeconds);
        state.jumpVelocity -= 1450 * deltaSeconds;
        if (state.jumpHeight === 0) {
          state.jumpVelocity = 0;
        }
      }
      obstacleTimer -= deltaSeconds;
      crystalTimer -= deltaSeconds;
      if (obstacleTimer <= 0) {
        spawnObstacle();
        obstacleTimer = Math.max(.86, 1.45 - state.distance / 4500) + Math.random() * .42;
      }
      if (crystalTimer <= 0) {
        spawnCrystal();
        crystalTimer = 3.7 + Math.random() * 2;
      }
      state.obstacles.forEach(function (obstacle) {
        obstacle.y += state.speed * deltaSeconds * .72;
        obstacle.warning = obstacle.y < 425;
        if (!obstacle.passed && obstacle.y > 420) {
          obstacle.passed = true;
        }
      });
      state.crystals.forEach(function (crystal) {
        crystal.y += state.speed * deltaSeconds * .72;
        if (!crystal.collected && crystal.lane === state.lane && crystal.y > 397 && crystal.y < 444) {
          crystal.collected = true;
          crystalTimer = Math.max(.8, crystalTimer);
          state.cooldown = reduceCooldown(state.cooldown, 3);
          state.crystalsCollected += 1;
          createParticles(laneX(crystal.lane, crystal.y), crystal.y, "#f5d878", 12);
          document.getElementById("gameAnnouncement").textContent = "Cristal recogido. Recarga reducida.";
        }
      });
      breakObstacleWithBone();
      let collision = false;
      state.obstacles.forEach(function (obstacle) {
        if (!collision && obstacleCollision(obstacle)) {
          collision = true;
        }
      });
      if (collision && state.invulnerableTime <= 0) {
        finishRun();
      }
      state.obstacles = state.obstacles.filter(function (obstacle) { return obstacle.y < 500; });
      state.crystals = state.crystals.filter(function (crystal) { return crystal.y < 500 && !crystal.collected; });
      state.particles.forEach(function (particle) {
        particle.x += particle.velocityX * deltaSeconds;
        particle.y += particle.velocityY * deltaSeconds;
        particle.life -= deltaSeconds;
      });
      state.particles = state.particles.filter(function (particle) { return particle.life > 0; });
      updateHud();
    }
  }

  function gameLoop(timestamp) {
    const deltaSeconds = Math.min(.04, Math.max(0, (timestamp - lastFrameTime) / 1000));
    lastFrameTime = timestamp;
    if (state.phase === "running") {
      update(deltaSeconds);
    }
    drawScene(timestamp / 1000);
    if (state.phase === "running") {
      animationFrame = window.requestAnimationFrame(gameLoop);
    }
  }

  function pauseGame() {
    if (state.phase === "running") {
      state.phase = "paused";
      pauseScreen.hidden = false;
      touchControls.hidden = true;
      if (animationFrame) {
        window.cancelAnimationFrame(animationFrame);
        animationFrame = 0;
      }
      resumeButton.focus();
    }
  }

  function resumeGame() {
    if (state.phase === "paused") {
      state.phase = "running";
      pauseScreen.hidden = true;
      touchControls.hidden = false;
      lastFrameTime = performance.now();
      animationFrame = window.requestAnimationFrame(gameLoop);
      canvas.focus();
    }
  }

  function returnToMenu() {
    state.phase = "menu";
    resultScreen.hidden = true;
    pauseScreen.hidden = true;
    hud.hidden = true;
    touchControls.hidden = true;
    menuScreen.hidden = false;
    canvas.closest(".game-frame").classList.remove("is-playing");
    document.getElementById("storageNotice").hidden = true;
    if (recordsState.persistent) {
      recordsState = storageRead();
    }
    setSelection(selectedCharacter);
    startButton.focus();
  }

  function drawInitialScene() {
    drawMenuBackground(context);
    drawCharacter(context, selectedCharacter, 676, 433, 0, false);
  }

  function handleKey(event) {
    let handled = false;
    if (state.phase === "running" || state.phase === "paused") {
      if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") {
        move(-1); handled = true;
      } else if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") {
        move(1); handled = true;
      } else if (event.key === " " || event.key === "ArrowUp" || event.key.toLowerCase() === "w") {
        jump(); handled = true;
      } else if (event.key.toLowerCase() === "x" || event.key.toLowerCase() === "f") {
        activateAbility(); handled = true;
      } else if (event.key === "Escape" || event.key.toLowerCase() === "p") {
        if (state.phase === "running") { pauseGame(); } else if (state.phase === "paused") { resumeGame(); }
        handled = true;
      }
    }
    if (handled) {
      event.preventDefault();
    }
  }

  function bindControls() {
    document.addEventListener("keydown", handleKey);
    document.getElementById("leftButton").addEventListener("click", function () { move(-1); });
    document.getElementById("rightButton").addEventListener("click", function () { move(1); });
    document.getElementById("jumpButton").addEventListener("click", jump);
    document.getElementById("skillButton").addEventListener("click", activateAbility);
    canvas.addEventListener("pointerdown", function (event) { canvas.dataset.startX = String(event.clientX); canvas.dataset.startY = String(event.clientY); });
    canvas.addEventListener("pointerup", function (event) {
      const startX = Number(canvas.dataset.startX || event.clientX);
      const startY = Number(canvas.dataset.startY || event.clientY);
      const differenceX = event.clientX - startX;
      const differenceY = event.clientY - startY;
      if (Math.abs(differenceX) > 30 && Math.abs(differenceX) > Math.abs(differenceY)) {
        move(differenceX < 0 ? -1 : 1);
      } else if (differenceY < -35) {
        jump();
      }
    });
    canvas.addEventListener("pointercancel", function () { delete canvas.dataset.startX; delete canvas.dataset.startY; });
    startButton.addEventListener("click", createStateForRun);
    retryButton.addEventListener("click", createStateForRun);
    resumeButton.addEventListener("click", resumeGame);
    pauseButton.addEventListener("click", pauseGame);
    changeCharacterButton.addEventListener("click", returnToMenu);
    characterButtons.forEach(function (button) {
      button.addEventListener("click", function () { setSelection(button.dataset.character); drawInitialScene(); });
    });
  }

  bindControls();
  recordsState = storageRead();
  document.getElementById("topRecord").textContent = String(recordsState.value.overall) + " m";
  document.getElementById("menuRecord").textContent = String(recordsState.value.byCharacter[selectedCharacter] || 0) + " m";
  if (!recordsState.persistent) {
    document.getElementById("storageNotice").textContent = "El navegador podría no conservar récords al cerrar esta página local.";
    document.getElementById("storageNotice").hidden = false;
  }
  drawInitialScene();
}());