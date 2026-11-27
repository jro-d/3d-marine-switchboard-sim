extends Node3D
class_name VcbTrolley

const WHEEL_RADIUS: float = 0.070
const DEFAULT_DECK_HEIGHT: float = 0.480
const HV_BAY_RAIL_HEIGHT: float = 0.233

@onready var model: Node3D = $Model

var deck_lift: Node3D
var bed_anchor: Node3D
var latch_l: Node3D
var latch_r: Node3D
var piston_rod: Node3D
var wheels: Array[Node3D] = []
var deck_height: float = DEFAULT_DECK_HEIGHT
var latches_engaged: bool = false


func _ready() -> void:
	if model == null:
		return
	deck_lift = model.find_child("TrolleyDeckLift", true, false) as Node3D
	bed_anchor = model.find_child("VcbBedAnchor", true, false) as Node3D
	latch_l = model.find_child("TrolleyLatchHook_L", true, false) as Node3D
	latch_r = model.find_child("TrolleyLatchHook_R", true, false) as Node3D
	piston_rod = model.find_child("TrolleyPistonRod", true, false) as Node3D
	wheels.clear()
	for i in range(4):
		var w := model.find_child("TrolleyWheel_%d" % i, true, false) as Node3D
		if w != null:
			wheels.append(w)


func set_deck_height(height_m: float) -> void:
	deck_height = clampf(height_m, HV_BAY_RAIL_HEIGHT, 0.54)
	if deck_lift != null:
		deck_lift.position.y = deck_height
	if piston_rod != null:
		var t := (deck_height - HV_BAY_RAIL_HEIGHT) / maxf(0.001, DEFAULT_DECK_HEIGHT - HV_BAY_RAIL_HEIGHT)
		piston_rod.scale.y = clampf(0.25 + 0.75 * t, 0.20, 1.15)


func set_latches_engaged(engaged: bool) -> void:
	latches_engaged = engaged
	var angle := deg_to_rad(-28.0) if engaged else 0.0
	if latch_l != null:
		latch_l.rotation.x = angle
	if latch_r != null:
		latch_r.rotation.x = angle


func spin_wheels(distance_m: float) -> void:
	var delta_rad := distance_m / WHEEL_RADIUS
	for w in wheels:
		w.rotation.x += delta_rad


func mount_vcb_cassette(cassette: Node3D) -> void:
	if bed_anchor == null or cassette == null:
		return
	if cassette.get_parent() != null:
		cassette.get_parent().remove_child(cassette)
	bed_anchor.add_child(cassette)
	cassette.position = Vector3.ZERO
	cassette.rotation = Vector3.ZERO
