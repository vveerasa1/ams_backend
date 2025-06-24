const router = require("express").Router();
const {
  upsertRole,
  deleteRole,
  getAllRoles,
  getFilteredRoles,
  getRoleById,
} = require("../services/roleService");

router.post("/", upsertRole);
router.get("/", getAllRoles);
router.get("/filter", getFilteredRoles);
router.get("/:id", getRoleById);
router.delete("/:id", deleteRole);

module.exports = router;
