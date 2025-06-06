const router = require("express").Router();
const { addRole, editRole, deleteRole, getAllRoles, getFilteredRoles } = require("../services/roleService");

router.post("/", addRole);
router.get("/", getAllRoles);
router.get("/filter", getFilteredRoles);
router.put("/:id", editRole);
router.delete("/:id", deleteRole);


module.exports = router;