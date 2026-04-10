// Goal UI module
(function() {
  'use strict';

  let goalCurrent = 0;
  let goalTarget = 100;
  let goalInited = false;

  function updateGoalBar() {
    const pct = Math.min(100, goalTarget > 0 ? (goalCurrent / goalTarget) * 100 : 0);
    document.getElementById('goal-fill').style.width = pct + '%';
    document.getElementById('goal-text').textContent = goalCurrent + ' / ' + goalTarget;
  }

  function addToGoal(amount) {
    const num = parseFloat(amount);
    const safe = isNaN(num) ? 0 : Math.max(0, num);
    if (safe > 0) {
      goalCurrent += safe;
      updateGoalBar();
    }
  }

  function setGoal(current, target, title) {
    if (!goalInited && current !== undefined) {
      goalCurrent = Math.max(0, parseInt(current) || 0);
      goalInited = true;
    }
    if (target !== undefined) {
      goalTarget = Math.max(0, parseInt(target) || 0);
    }
    if (title !== undefined) {
      const titleEl = document.getElementById('goal-title');
      if (titleEl) titleEl.textContent = title || 'STREAM GOAL';
    }

    const goalEl = document.getElementById('goal');
    if (goalEl) {
      goalEl.classList.toggle('hidden', goalTarget <= 0);
    }

    updateGoalBar();
  }

  function resetGoal() {
    goalCurrent = 0;
    updateGoalBar();
  }

  // Export to global
  window.GoalUI = {
    updateGoalBar,
    addToGoal,
    setGoal,
    resetGoal,
  };
})();
