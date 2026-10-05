/*
  La Carrera Monstruosa — Pruebas de reglas
  Copyright (c) 2026 Proyecto personal
  Uso personal; no distribuido públicamente.
  Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
*/
(function () {
  "use strict";

  const rules = window.CarreraMonstruosaRules;
  const summary = document.getElementById("summary");
  const results = document.getElementById("results");
  const cases = [
    { name: "Hay cinco personajes con identificadores distintos", run: function () { return rules.characters.length === 5 && new Set(rules.characters.map(function (character) { return character.id; })).size === 5; } },
    { name: "Las habilidades duran 1,5 segundos y recargan en 10", run: function () { return rules.abilityDuration === 1.5 && rules.baseCooldown === 10; } },
    { name: "El carril cambia a izquierda y derecha", run: function () { return rules.moveLane(1, -1) === 0 && rules.moveLane(1, 1) === 2; } },
    { name: "El jugador no sale de los carriles extremos", run: function () { return rules.moveLane(0, -1) === 0 && rules.moveLane(2, 1) === 2; } },
    { name: "Los carriles siguen la perspectiva desde el horizonte", run: function () { return rules.roadHorizonY === 300 && rules.laneX(0, 540) < rules.laneX(0, rules.roadHorizonY) && rules.laneX(2, 540) > rules.laneX(2, rules.roadHorizonY) && Math.abs(rules.laneX(1, rules.roadHorizonY) - 480) < .01 && Math.abs(rules.laneX(1, 540) - 480) < .01; } },
    { name: "Un cristal reduce 3 segundos sin enfriamiento negativo", run: function () { return rules.reduceCooldown(8, 3) === 5 && rules.reduceCooldown(2, 3) === 0; } },
    { name: "El hombre lobo recibe el impulso del salto largo", run: function () { return rules.getJumpVelocity("werewolf", true) === 810 && rules.getJumpVelocity("werewolf", false) === 570; } },
    { name: "El bumerán del esqueleto solo rompe en su carril", run: function () { return rules.canBreakObstacle("skeleton", true, true) && !rules.canBreakObstacle("skeleton", true, false) && !rules.canBreakObstacle("ghost", true, true); } },
    { name: "El escenario cambia de castillo a bosque y cementerio", run: function () { return rules.getBiome(0) === "castle" && rules.getBiome(450) === "forest" && rules.getBiome(1100) === "cemetery"; } },
    { name: "El fantasma atraviesa bloqueos y peligros elevados con fase activa", run: function () { return rules.isObstacleAvoided("ghost", "block", 0, true, false) && rules.isObstacleAvoided("ghost", "overhead", 0, true, false); } },
    { name: "La bruja sobrevuela trampas del suelo, pero no atraviesa objetos sólidos", run: function () { return rules.isObstacleAvoided("witch", "root", 0, true, false) && rules.isObstacleAvoided("witch", "log", 0, true, false) && rules.isObstacleAvoided("witch", "gap", 0, true, false) && !rules.isObstacleAvoided("witch", "armor", 0, true, false) && !rules.isObstacleAvoided("witch", "block", 0, true, false) && !rules.isObstacleAvoided("witch", "tombstone", 0, true, false) && !rules.isObstacleAvoided("witch", "gate", 0, true, false) && !rules.isObstacleAvoided("witch", "overhead", 0, true, false); } },
    { name: "El salto supera raíces, pero exige cambiar de carril ante una armadura", run: function () { return rules.isObstacleAvoided("vampire", "root", 50, false, false) && !rules.isObstacleAvoided("vampire", "armor", 50, false, false); } },
    { name: "El hombre lobo supera huecos grandes y obstáculos altos con el salto largo activo", run: function () { return rules.isObstacleAvoided("werewolf", "gap", 0, true, false) && rules.isObstacleAvoided("werewolf", "armor", 0, true, false) && !rules.isObstacleAvoided("werewolf", "overhead", 0, true, false); } },
    { name: "Raíces, troncos y fosas admiten salto; bloqueos pesados no", run: function () { return rules.canJumpObstacle("root") && rules.canJumpObstacle("log") && rules.canJumpObstacle("gap") && !rules.canJumpObstacle("armor") && !rules.canJumpObstacle("block") && !rules.canJumpObstacle("tombstone") && !rules.canJumpObstacle("gate"); } },
    { name: "El escudo del vampiro bloquea el primer impacto antes que cualquier salto", run: function () { return rules.isObstacleAvoided("vampire", "block", 0, true, true) && rules.isObstacleAvoided("vampire", "root", 50, true, true) && rules.isObstacleAvoided("vampire", "gate", 0, true, true); } },
    { name: "Los récords válidos se normalizan", run: function () { const result = rules.normalizeRecords({ overall: 350, byCharacter: { witch: 240 } }); return result.ok && result.value.overall === 350 && result.value.byCharacter.witch === 240; } },
    { name: "Los récords negativos o mal formados se rechazan", run: function () { return !rules.normalizeRecords({ overall: -2 }).ok && !rules.normalizeRecords([]).ok; } },
    { name: "Un récord nuevo actualiza el global y el monstruo correcto", run: function () { const result = rules.updateRecord({ overall: 350, byCharacter: { ghost: 240 } }, "witch", 420); return result.ok && result.value.overall === 420 && result.value.byCharacter.witch === 420 && result.value.byCharacter.ghost === 240; } },
    { name: "No se reemplaza un récord por una carrera menor", run: function () { const result = rules.updateRecord({ overall: 500, byCharacter: { witch: 430 } }, "witch", 200); return result.ok && result.value.overall === 500 && result.value.byCharacter.witch === 430; } }
  ];

  let passed = 0;
  cases.forEach(function (testCase) {
    const item = document.createElement("li");
    let successful = false;
    try {
      successful = testCase.run();
    } catch (error) {
      if (error instanceof TypeError || error instanceof ReferenceError) {
        successful = false;
      } else {
        throw error;
      }
    }
    item.className = successful ? "pass" : "fail";
    item.textContent = (successful ? "APROBADA · " : "FALLÓ · ") + testCase.name;
    results.append(item);
    if (successful) {
      passed += 1;
    }
  });

  summary.className = passed === cases.length ? "pass" : "fail";
  summary.textContent = String(passed) + " de " + String(cases.length) + " pruebas aprobadas.";
}());