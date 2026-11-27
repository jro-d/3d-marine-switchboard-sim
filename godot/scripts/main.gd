extends Node3D

@onready var hv_sim: HvSimCore = $HvSimCore
@onready var lineup: Node3D = $SwitchboardLineup
@onready var trolley: VcbTrolley = $VcbTrolley
@onready var toolbelt_props: Node3D = $ToolbeltProps


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
	if trolley != null:
		assert(trolley.deck_lift != null, "Missing TrolleyDeckLift on VcbTrolley")
		assert(trolley.bed_anchor != null, "Missing VcbBedAnchor on VcbTrolley")
		assert(trolley.latch_l != null and trolley.latch_r != null, "Missing TrolleyLatchHook_L/R")
		assert(trolley.wheels.size() == 4, "Expected 4 TrolleyWheel_0..3 pivots, found %d" % trolley.wheels.size())
		trolley.set_deck_height(VcbTrolley.HV_BAY_RAIL_HEIGHT)
		trolley.set_latches_engaged(true)
		var bt_m1 := lineup.get_node_or_null("BT-M1") as HvBay
		if bt_m1 != null and bt_m1.vcb_cassette != null:
			var orig_mount := bt_m1.vcb_mount
			trolley.mount_vcb_cassette(bt_m1.vcb_cassette)
			assert(bt_m1.vcb_cassette.get_parent() == trolley.bed_anchor, "VCB did not mount cleanly onto trolley bed_anchor")
			trolley.bed_anchor.remove_child(bt_m1.vcb_cassette)
			orig_mount.add_child(bt_m1.vcb_cassette)
			bt_m1.vcb_cassette.position = Vector3.ZERO
		trolley.set_latches_engaged(false)
		trolley.set_deck_height(VcbTrolley.DEFAULT_DECK_HEIGHT)
		print("VcbTrolley ready with %d articulated wheels and deck lift" % trolley.wheels.size())
	if toolbelt_props != null:
		var tool_names: PackedStringArray = []
		for child in toolbelt_props.get_children():
			if child is HandheldTool:
				assert(child.tip_anchor != null, "Missing TipAnchor on %s" % child.name)
				tool_names.append(child.name)
		print("ToolbeltProps ready with %d tools: %s" % [tool_names.size(), ", ".join(tool_names)])
