/* eslint-disable @typescript-eslint/ban-types */
import { GenericEntityDTO, PICK_ENTITY } from "./helpers";

/**
 * ## THIS FILE IS INTENDED TO BE REPLACED
 *
 * The purpose it to represent the configuration of Home Assistant
 *
 * - entities, with their available attributes & states
 * - services, and what parameters they take
 *
 * This information is TYPES ONLY, and is used to add type safety to
 * methods exported from this library through the use of utility types that
 * take advantage of this information
 *
 * A post-install hook will regenerate these with real values.
 *
 * The service definition is the switch, light, scene domains from a previously generated file.
 * These are required to make typescript happy for internal library definitions
 */

export const ENTITY_SETUP: Record<
  string,
  Record<string, GenericEntityDTO>
> = {};

export type iCallService = {
  switch: {
    /**
     * ## Turn off
     *
     * Turns a switch off.*/
    turn_off(service_data: {
      /*Assisted definition*/
      entity_id: string | string[];
    }): Promise<void>;
    /**
     * ## Turn on
     *
     * Turns a switch on.*/
    turn_on(service_data: {
      /*Assisted definition*/
      entity_id: string | string[];
    }): Promise<void>;
    /**
     * ## Toggle
     *
     * Toggles a switch on/off.*/
    toggle(service_data: {
      /*Assisted definition*/
      entity_id: string | string[];
    }): Promise<void>;
  };
  light: {
    /**
     * ## Turn on
     *
     * Turn on one or more lights and adjust properties of the light, even when they are turned on already.*/
    turn_on(service_data: {
      /**
         * ## Transition
         *
         * Duration it takes to get to next state.
         *
         * @example undefined
         *
         * ## Selector
         *
         * ```yaml
         * number:
          min: 0
          max: 300
          unit_of_measurement: seconds

         * ```*/
      transition?: number;
      /**
         * ## Color
         *
         * The color in RGB format. A list of three integers between 0 and 255 representing the values of red, green, and blue.
         *
         * @example undefined
         *
         * ## Selector
         *
         * ```yaml
         * color_rgb: null

         * ```*/
      rgb_color?: unknown;
      /**
         * ## RGBW-color
         *
         * The color in RGBW format. A list of four integers between 0 and 255 representing the values of red, green, blue, and white.
         *
         * @example [255, 100, 100, 50]
         *
         * ## Selector
         *
         * ```yaml
         * object: null

         * ```*/
      rgbw_color?: Record<string, unknown> | unknown[];
      /**
         * ## RGBWW-color
         *
         * The color in RGBWW format. A list of five integers between 0 and 255 representing the values of red, green, blue, cold white, and warm white.
         *
         * @example [255, 100, 100, 50, 70]
         *
         * ## Selector
         *
         * ```yaml
         * object: null

         * ```*/
      rgbww_color?: Record<string, unknown> | unknown[];
      /**
         * ## Color name
         *
         * A human-readable color name.
         *
         * @example undefined
         *
         * ## Selector
         *
         * ```yaml
         * select:
          translation_key: color_name
          options:
            - homeassistant
            - aliceblue
            - antiquewhite
            - aqua
            - aquamarine
            - azure
            - beige
            - bisque
            - blanchedalmond
            - blue
            - blueviolet
            - brown
            - burlywood
            - cadetblue
            - chartreuse
            - chocolate
            - coral
            - cornflowerblue
            - cornsilk
            - crimson
            - cyan
            - darkblue
            - darkcyan
            - darkgoldenrod
            - darkgray
            - darkgreen
            - darkgrey
            - darkkhaki
            - darkmagenta
            - darkolivegreen
            - darkorange
            - darkorchid
            - darkred
            - darksalmon
            - darkseagreen
            - darkslateblue
            - darkslategray
            - darkslategrey
            - darkturquoise
            - darkviolet
            - deeppink
            - deepskyblue
            - dimgray
            - dimgrey
            - dodgerblue
            - firebrick
            - floralwhite
            - forestgreen
            - fuchsia
            - gainsboro
            - ghostwhite
            - gold
            - goldenrod
            - gray
            - green
            - greenyellow
            - grey
            - honeydew
            - hotpink
            - indianred
            - indigo
            - ivory
            - khaki
            - lavender
            - lavenderblush
            - lawngreen
            - lemonchiffon
            - lightblue
            - lightcoral
            - lightcyan
            - lightgoldenrodyellow
            - lightgray
            - lightgreen
            - lightgrey
            - lightpink
            - lightsalmon
            - lightseagreen
            - lightskyblue
            - lightslategray
            - lightslategrey
            - lightsteelblue
            - lightyellow
            - lime
            - limegreen
            - linen
            - magenta
            - maroon
            - mediumaquamarine
            - mediumblue
            - mediumorchid
            - mediumpurple
            - mediumseagreen
            - mediumslateblue
            - mediumspringgreen
            - mediumturquoise
            - mediumvioletred
            - midnightblue
            - mintcream
            - mistyrose
            - moccasin
            - navajowhite
            - navy
            - navyblue
            - oldlace
            - olive
            - olivedrab
            - orange
            - orangered
            - orchid
            - palegoldenrod
            - palegreen
            - paleturquoise
            - palevioletred
            - papayawhip
            - peachpuff
            - peru
            - pink
            - plum
            - powderblue
            - purple
            - red
            - rosybrown
            - royalblue
            - saddlebrown
            - salmon
            - sandybrown
            - seagreen
            - seashell
            - sienna
            - silver
            - skyblue
            - slateblue
            - slategray
            - slategrey
            - snow
            - springgreen
            - steelblue
            - tan
            - teal
            - thistle
            - tomato
            - turquoise
            - violet
            - wheat
            - white
            - whitesmoke
            - yellow
            - yellowgreen

         * ```*/
      color_name?:
        | "homeassistant"
        | "aliceblue"
        | "antiquewhite"
        | "aqua"
        | "aquamarine"
        | "azure"
        | "beige"
        | "bisque"
        | "blanchedalmond"
        | "blue"
        | "blueviolet"
        | "brown"
        | "burlywood"
        | "cadetblue"
        | "chartreuse"
        | "chocolate"
        | "coral"
        | "cornflowerblue"
        | "cornsilk"
        | "crimson"
        | "cyan"
        | "darkblue"
        | "darkcyan"
        | "darkgoldenrod"
        | "darkgray"
        | "darkgreen"
        | "darkgrey"
        | "darkkhaki"
        | "darkmagenta"
        | "darkolivegreen"
        | "darkorange"
        | "darkorchid"
        | "darkred"
        | "darksalmon"
        | "darkseagreen"
        | "darkslateblue"
        | "darkslategray"
        | "darkslategrey"
        | "darkturquoise"
        | "darkviolet"
        | "deeppink"
        | "deepskyblue"
        | "dimgray"
        | "dimgrey"
        | "dodgerblue"
        | "firebrick"
        | "floralwhite"
        | "forestgreen"
        | "fuchsia"
        | "gainsboro"
        | "ghostwhite"
        | "gold"
        | "goldenrod"
        | "gray"
        | "green"
        | "greenyellow"
        | "grey"
        | "honeydew"
        | "hotpink"
        | "indianred"
        | "indigo"
        | "ivory"
        | "khaki"
        | "lavender"
        | "lavenderblush"
        | "lawngreen"
        | "lemonchiffon"
        | "lightblue"
        | "lightcoral"
        | "lightcyan"
        | "lightgoldenrodyellow"
        | "lightgray"
        | "lightgreen"
        | "lightgrey"
        | "lightpink"
        | "lightsalmon"
        | "lightseagreen"
        | "lightskyblue"
        | "lightslategray"
        | "lightslategrey"
        | "lightsteelblue"
        | "lightyellow"
        | "lime"
        | "limegreen"
        | "linen"
        | "magenta"
        | "maroon"
        | "mediumaquamarine"
        | "mediumblue"
        | "mediumorchid"
        | "mediumpurple"
        | "mediumseagreen"
        | "mediumslateblue"
        | "mediumspringgreen"
        | "mediumturquoise"
        | "mediumvioletred"
        | "midnightblue"
        | "mintcream"
        | "mistyrose"
        | "moccasin"
        | "navajowhite"
        | "navy"
        | "navyblue"
        | "oldlace"
        | "olive"
        | "olivedrab"
        | "orange"
        | "orangered"
        | "orchid"
        | "palegoldenrod"
        | "palegreen"
        | "paleturquoise"
        | "palevioletred"
        | "papayawhip"
        | "peachpuff"
        | "peru"
        | "pink"
        | "plum"
        | "powderblue"
        | "purple"
        | "red"
        | "rosybrown"
        | "royalblue"
        | "saddlebrown"
        | "salmon"
        | "sandybrown"
        | "seagreen"
        | "seashell"
        | "sienna"
        | "silver"
        | "skyblue"
        | "slateblue"
        | "slategray"
        | "slategrey"
        | "snow"
        | "springgreen"
        | "steelblue"
        | "tan"
        | "teal"
        | "thistle"
        | "tomato"
        | "turquoise"
        | "violet"
        | "wheat"
        | "white"
        | "whitesmoke"
        | "yellow"
        | "yellowgreen";
      /**
         * ## Hue/Sat color
         *
         * Color in hue/sat format. A list of two integers. Hue is 0-360 and Sat is 0-100.
         *
         * @example [300, 70]
         *
         * ## Selector
         *
         * ```yaml
         * object: null

         * ```*/
      hs_color?: Record<string, unknown> | unknown[];
      /**
         * ## XY-color
         *
         * Color in XY-format. A list of two decimal numbers between 0 and 1.
         *
         * @example [0.52, 0.43]
         *
         * ## Selector
         *
         * ```yaml
         * object: null

         * ```*/
      xy_color?: Record<string, unknown> | unknown[];
      /**
         * ## Color temperature
         *
         * Color temperature in mireds.
         *
         * @example undefined
         *
         * ## Selector
         *
         * ```yaml
         * color_temp:
          min_mireds: 153
          max_mireds: 500

         * ```*/
      color_temp?: unknown;
      /**
         * ## Color temperature
         *
         * Color temperature in Kelvin.
         *
         * @example undefined
         *
         * ## Selector
         *
         * ```yaml
         * number:
          min: 2000
          max: 6500
          step: 100
          unit_of_measurement: K

         * ```*/
      kelvin?: number;
      /**
         * ## Brightness value
         *
         * Number indicating brightness, where 0 turns the light off, 1 is the minimum brightness, and 255 is the maximum brightness.
         *
         * @example undefined
         *
         * ## Selector
         *
         * ```yaml
         * number:
          min: 0
          max: 255

         * ```*/
      brightness?: number;
      /**
         * ## Brightness
         *
         * Number indicating the percentage of full brightness, where 0 turns the light off, 1 is the minimum brightness, and 100 is the maximum brightness.
         *
         * @example undefined
         *
         * ## Selector
         *
         * ```yaml
         * number:
          min: 0
          max: 100
          unit_of_measurement: '%'

         * ```*/
      brightness_pct?: number;
      /**
         * ## Brightness step value
         *
         * Change brightness by an amount.
         *
         * @example undefined
         *
         * ## Selector
         *
         * ```yaml
         * number:
          min: -225
          max: 255

         * ```*/
      brightness_step?: number;
      /**
         * ## Brightness step
         *
         * Change brightness by a percentage.
         *
         * @example undefined
         *
         * ## Selector
         *
         * ```yaml
         * number:
          min: -100
          max: 100
          unit_of_measurement: '%'

         * ```*/
      brightness_step_pct?: number;
      /**
         * ## White
         *
         * Set the light to white mode.
         *
         * @example undefined
         *
         * ## Selector
         *
         * ```yaml
         * constant:
          value: true
          label: Enabled

         * ```*/
      white?: unknown;
      /**
         * ## Profile
         *
         * Name of a light profile to use.
         *
         * @example relax
         *
         * ## Selector
         *
         * ```yaml
         * text: null

         * ```*/
      profile?: string;
      /**
         * ## Flash
         *
         * Tell light to flash, can be either value short or long.
         *
         * @example undefined
         *
         * ## Selector
         *
         * ```yaml
         * select:
          options:
            - label: Long
              value: long
            - label: Short
              value: short

         * ```*/
      flash?: "long" | "short";
      /**
         * ## Effect
         *
         * Light effect.
         *
         * @example undefined
         *
         * ## Selector
         *
         * ```yaml
         * text: null

         * ```*/
      effect?: string;
      /*Assisted definition*/
      entity_id: string | string[];
    }): Promise<void>;
    /**
     * ## Turn off
     *
     * Turn off one or more lights.*/
    turn_off(service_data: {
      /**
         * ## Transition
         *
         * Duration it takes to get to next state.
         *
         * @example undefined
         *
         * ## Selector
         *
         * ```yaml
         * number:
          min: 0
          max: 300
          unit_of_measurement: seconds

         * ```*/
      transition?: number;
      /**
         * ## Flash
         *
         * Tell light to flash, can be either value short or long.
         *
         * @example undefined
         *
         * ## Selector
         *
         * ```yaml
         * select:
          options:
            - label: Long
              value: long
            - label: Short
              value: short

         * ```*/
      flash?: "long" | "short";
      /*Assisted definition*/
      entity_id: string | string[];
    }): Promise<void>;
    /**
     * ## Toggle
     *
     * Toggles one or more lights, from on to off, or, off to on, based on their current state.*/
    toggle(service_data: {
      /**
         * ## Transition
         *
         * Duration it takes to get to next state.
         *
         * @example undefined
         *
         * ## Selector
         *
         * ```yaml
         * number:
          min: 0
          max: 300
          unit_of_measurement: seconds

         * ```*/
      transition?: number;
      /**
         * ## Color
         *
         * The color in RGB format. A list of three integers between 0 and 255 representing the values of red, green, and blue.
         *
         * @example [255, 100, 100]
         *
         * ## Selector
         *
         * ```yaml
         * color_rgb: null

         * ```*/
      rgb_color?: unknown;
      /**
         * ## Color name
         *
         * A human-readable color name.
         *
         * @example undefined
         *
         * ## Selector
         *
         * ```yaml
         * select:
          translation_key: color_name
          options:
            - homeassistant
            - aliceblue
            - antiquewhite
            - aqua
            - aquamarine
            - azure
            - beige
            - bisque
            - blanchedalmond
            - blue
            - blueviolet
            - brown
            - burlywood
            - cadetblue
            - chartreuse
            - chocolate
            - coral
            - cornflowerblue
            - cornsilk
            - crimson
            - cyan
            - darkblue
            - darkcyan
            - darkgoldenrod
            - darkgray
            - darkgreen
            - darkgrey
            - darkkhaki
            - darkmagenta
            - darkolivegreen
            - darkorange
            - darkorchid
            - darkred
            - darksalmon
            - darkseagreen
            - darkslateblue
            - darkslategray
            - darkslategrey
            - darkturquoise
            - darkviolet
            - deeppink
            - deepskyblue
            - dimgray
            - dimgrey
            - dodgerblue
            - firebrick
            - floralwhite
            - forestgreen
            - fuchsia
            - gainsboro
            - ghostwhite
            - gold
            - goldenrod
            - gray
            - green
            - greenyellow
            - grey
            - honeydew
            - hotpink
            - indianred
            - indigo
            - ivory
            - khaki
            - lavender
            - lavenderblush
            - lawngreen
            - lemonchiffon
            - lightblue
            - lightcoral
            - lightcyan
            - lightgoldenrodyellow
            - lightgray
            - lightgreen
            - lightgrey
            - lightpink
            - lightsalmon
            - lightseagreen
            - lightskyblue
            - lightslategray
            - lightslategrey
            - lightsteelblue
            - lightyellow
            - lime
            - limegreen
            - linen
            - magenta
            - maroon
            - mediumaquamarine
            - mediumblue
            - mediumorchid
            - mediumpurple
            - mediumseagreen
            - mediumslateblue
            - mediumspringgreen
            - mediumturquoise
            - mediumvioletred
            - midnightblue
            - mintcream
            - mistyrose
            - moccasin
            - navajowhite
            - navy
            - navyblue
            - oldlace
            - olive
            - olivedrab
            - orange
            - orangered
            - orchid
            - palegoldenrod
            - palegreen
            - paleturquoise
            - palevioletred
            - papayawhip
            - peachpuff
            - peru
            - pink
            - plum
            - powderblue
            - purple
            - red
            - rosybrown
            - royalblue
            - saddlebrown
            - salmon
            - sandybrown
            - seagreen
            - seashell
            - sienna
            - silver
            - skyblue
            - slateblue
            - slategray
            - slategrey
            - snow
            - springgreen
            - steelblue
            - tan
            - teal
            - thistle
            - tomato
            - turquoise
            - violet
            - wheat
            - white
            - whitesmoke
            - yellow
            - yellowgreen

         * ```*/
      color_name?:
        | "homeassistant"
        | "aliceblue"
        | "antiquewhite"
        | "aqua"
        | "aquamarine"
        | "azure"
        | "beige"
        | "bisque"
        | "blanchedalmond"
        | "blue"
        | "blueviolet"
        | "brown"
        | "burlywood"
        | "cadetblue"
        | "chartreuse"
        | "chocolate"
        | "coral"
        | "cornflowerblue"
        | "cornsilk"
        | "crimson"
        | "cyan"
        | "darkblue"
        | "darkcyan"
        | "darkgoldenrod"
        | "darkgray"
        | "darkgreen"
        | "darkgrey"
        | "darkkhaki"
        | "darkmagenta"
        | "darkolivegreen"
        | "darkorange"
        | "darkorchid"
        | "darkred"
        | "darksalmon"
        | "darkseagreen"
        | "darkslateblue"
        | "darkslategray"
        | "darkslategrey"
        | "darkturquoise"
        | "darkviolet"
        | "deeppink"
        | "deepskyblue"
        | "dimgray"
        | "dimgrey"
        | "dodgerblue"
        | "firebrick"
        | "floralwhite"
        | "forestgreen"
        | "fuchsia"
        | "gainsboro"
        | "ghostwhite"
        | "gold"
        | "goldenrod"
        | "gray"
        | "green"
        | "greenyellow"
        | "grey"
        | "honeydew"
        | "hotpink"
        | "indianred"
        | "indigo"
        | "ivory"
        | "khaki"
        | "lavender"
        | "lavenderblush"
        | "lawngreen"
        | "lemonchiffon"
        | "lightblue"
        | "lightcoral"
        | "lightcyan"
        | "lightgoldenrodyellow"
        | "lightgray"
        | "lightgreen"
        | "lightgrey"
        | "lightpink"
        | "lightsalmon"
        | "lightseagreen"
        | "lightskyblue"
        | "lightslategray"
        | "lightslategrey"
        | "lightsteelblue"
        | "lightyellow"
        | "lime"
        | "limegreen"
        | "linen"
        | "magenta"
        | "maroon"
        | "mediumaquamarine"
        | "mediumblue"
        | "mediumorchid"
        | "mediumpurple"
        | "mediumseagreen"
        | "mediumslateblue"
        | "mediumspringgreen"
        | "mediumturquoise"
        | "mediumvioletred"
        | "midnightblue"
        | "mintcream"
        | "mistyrose"
        | "moccasin"
        | "navajowhite"
        | "navy"
        | "navyblue"
        | "oldlace"
        | "olive"
        | "olivedrab"
        | "orange"
        | "orangered"
        | "orchid"
        | "palegoldenrod"
        | "palegreen"
        | "paleturquoise"
        | "palevioletred"
        | "papayawhip"
        | "peachpuff"
        | "peru"
        | "pink"
        | "plum"
        | "powderblue"
        | "purple"
        | "red"
        | "rosybrown"
        | "royalblue"
        | "saddlebrown"
        | "salmon"
        | "sandybrown"
        | "seagreen"
        | "seashell"
        | "sienna"
        | "silver"
        | "skyblue"
        | "slateblue"
        | "slategray"
        | "slategrey"
        | "snow"
        | "springgreen"
        | "steelblue"
        | "tan"
        | "teal"
        | "thistle"
        | "tomato"
        | "turquoise"
        | "violet"
        | "wheat"
        | "white"
        | "whitesmoke"
        | "yellow"
        | "yellowgreen";
      /**
         * ## Hue/Sat color
         *
         * Color in hue/sat format. A list of two integers. Hue is 0-360 and Sat is 0-100.
         *
         * @example [300, 70]
         *
         * ## Selector
         *
         * ```yaml
         * object: null

         * ```*/
      hs_color?: Record<string, unknown> | unknown[];
      /**
         * ## XY-color
         *
         * Color in XY-format. A list of two decimal numbers between 0 and 1.
         *
         * @example [0.52, 0.43]
         *
         * ## Selector
         *
         * ```yaml
         * object: null

         * ```*/
      xy_color?: Record<string, unknown> | unknown[];
      /**
         * ## Color temperature
         *
         * Color temperature in mireds.
         *
         * @example undefined
         *
         * ## Selector
         *
         * ```yaml
         * color_temp: null

         * ```*/
      color_temp?: unknown;
      /**
         * ## Color temperature
         *
         * Color temperature in Kelvin.
         *
         * @example undefined
         *
         * ## Selector
         *
         * ```yaml
         * number:
          min: 2000
          max: 6500
          step: 100
          unit_of_measurement: K

         * ```*/
      kelvin?: number;
      /**
         * ## Brightness value
         *
         * Number indicating brightness, where 0 turns the light off, 1 is the minimum brightness, and 255 is the maximum brightness.
         *
         * @example undefined
         *
         * ## Selector
         *
         * ```yaml
         * number:
          min: 0
          max: 255

         * ```*/
      brightness?: number;
      /**
         * ## Brightness
         *
         * Number indicating the percentage of full brightness, where 0 turns the light off, 1 is the minimum brightness, and 100 is the maximum brightness.
         *
         * @example undefined
         *
         * ## Selector
         *
         * ```yaml
         * number:
          min: 0
          max: 100
          unit_of_measurement: '%'

         * ```*/
      brightness_pct?: number;
      /**
         * ## White
         *
         * Set the light to white mode.
         *
         * @example undefined
         *
         * ## Selector
         *
         * ```yaml
         * constant:
          value: true
          label: Enabled

         * ```*/
      white?: unknown;
      /**
         * ## Profile
         *
         * Name of a light profile to use.
         *
         * @example relax
         *
         * ## Selector
         *
         * ```yaml
         * text: null

         * ```*/
      profile?: string;
      /**
         * ## Flash
         *
         * Tell light to flash, can be either value short or long.
         *
         * @example undefined
         *
         * ## Selector
         *
         * ```yaml
         * select:
          options:
            - label: Long
              value: long
            - label: Short
              value: short

         * ```*/
      flash?: "long" | "short";
      /**
         * ## Effect
         *
         * Light effect.
         *
         * @example undefined
         *
         * ## Selector
         *
         * ```yaml
         * text: null

         * ```*/
      effect?: string;
      /*Assisted definition*/
      entity_id: string | string[];
    }): Promise<void>;
  };
  scene: {
    /**
     * ## Reload
     *
     * Reloads the scenes from the YAML-configuration.*/
    reload(service_data: {}): Promise<void>;
    /**
     * ## Apply
     *
     * Activates a scene with configuration.*/
    apply(service_data: {
      /**
         * ## Entities state
         *
         * List of entities and their target state.
         *
         * @example light.kitchen: "on"
        light.ceiling:
          state: "on"
          brightness: 80

         *
         * ## Selector
         *
         * ```yaml
         * object: null

         * ```*/
      entities: Partial<Record<PICK_ENTITY, unknown>> | unknown[];
      /**
         * ## Transition
         *
         * Time it takes the devices to transition into the states defined in the scene.
         *
         * @example undefined
         *
         * ## Selector
         *
         * ```yaml
         * number:
          min: 0
          max: 300
          unit_of_measurement: seconds

         * ```*/
      transition?: number;
    }): Promise<void>;
    /**
     * ## Create
     *
     * Creates a new scene.*/
    create(service_data: {
      /**
         * ## Scene entity ID
         *
         * The entity ID of the new scene.
         *
         * @example all_lights
         *
         * ## Selector
         *
         * ```yaml
         * text: null

         * ```*/
      scene_id: string;
      /**
         * ## Entities state
         *
         * List of entities and their target state. If your entities are already in the target state right now, use `snapshot_entities` instead.
         *
         * @example light.tv_back_light: "on"
        light.ceiling:
          state: "on"
          brightness: 200

         *
         * ## Selector
         *
         * ```yaml
         * object: null

         * ```*/
      entities?: Record<string, unknown> | unknown[];
      /**
         * ## Snapshot entities
         *
         * List of entities to be included in the snapshot. By taking a snapshot, you record the current state of those entities. If you do not want to use the current state of all your entities for this scene, you can combine the `snapshot_entities` with `entities`.
         *
         * @example - light.ceiling
        - light.kitchen

         *
         * ## Selector
         *
         * ```yaml
         * entity:
          multiple: true

         * ```*/
      snapshot_entities?: string;
    }): Promise<void>;
    /**
     * ## Activate
     *
     * Activates a scene.*/
    turn_on(service_data: {
      /**
         * ## Transition
         *
         * Time it takes the devices to transition into the states defined in the scene.
         *
         * @example undefined
         *
         * ## Selector
         *
         * ```yaml
         * number:
          min: 0
          max: 300
          unit_of_measurement: seconds

         * ```*/
      transition?: number;
      /*Assisted definition*/
      entity_id: string | string[];
    }): Promise<void>;
  };
};
