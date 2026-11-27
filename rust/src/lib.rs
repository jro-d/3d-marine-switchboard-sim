use godot::prelude::*;

struct MarineHvSimExtension;

#[gdextension]
unsafe impl ExtensionLibrary for MarineHvSimExtension {}

/// Core 6.6 kV marine switchboard simulation node exposed to Godot via GDExtension.
#[derive(GodotClass)]
#[class(base=Node)]
pub struct HvSimCore {
    base: Base<Node>,
    #[var]
    busbar_kv: f64,
}

#[godot_api]
impl INode for HvSimCore {
    fn init(base: Base<Node>) -> Self {
        Self {
            base,
            busbar_kv: 6.6,
        }
    }

    fn ready(&mut self) {
        godot_print!("HvSimCore (Rust GDExtension) initialized at {:.1} kV", self.busbar_kv);
    }
}

#[godot_api]
impl HvSimCore {
    /// Returns a status string confirming the Rust GDExtension bridge is active.
    #[func]
    fn get_sim_info(&self) -> GString {
        let msg = format!("Marine HV Switchboard Core ({:.1} kV) — Rust GDExtension active", self.busbar_kv);
        GString::from(&msg)
    }
}
