extends Node3D

@onready var hv_sim: HvSimCore = $HvSimCore
@onready var lineup: Node3D = $SwitchboardLineup


func _ready() -> void:
	if hv_sim != null:
		print(hv_sim.get_sim_info())
	if lineup != null:
		var bay_names: PackedStringArray = []
		for child in lineup.get_children():
			bay_names.append(child.name)
			if child is HvBay:
				assert(child.lv_door_pivot != null, "Missing LvDoorPivot on %s" % child.name)
				assert(child.breaker_door_pivot != null, "Missing BreakerDoorPivot on %s" % child.name)
				assert(child.vcb_cassette != null, "Missing VcbCassette on %s" % child.name)
			elif child is LvBay:
				assert(child.upper_door_pivot != null, "Missing LvUpperDoorPivot on %s" % child.name)
				assert(child.lower_door_pivot != null, "Missing LvLowerDoorPivot on %s" % child.name)
		print("SwitchboardLineup ready with %d bays: %s" % [bay_names.size(), ", ".join(bay_names)])
