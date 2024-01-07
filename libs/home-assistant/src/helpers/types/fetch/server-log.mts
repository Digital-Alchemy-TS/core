// {
// 	"0": {
// 		"name": "homeassistant.util.yaml.loader",
// 		"message": [
// 			"mapping values are not allowed here\n  in \"/config/configuration.yaml\", line 71, column 8"
// 		],
// 		"level": "ERROR",
// 		"source": [
// 			"util/yaml/loader.py",
// 			127
// 		],
// 		"timestamp": 1638118416.470104,
// 		"exception": "",
// 		"count": 2,
// 		"first_occurred": 1638118343.795454
// 	}
// }

export class HomeAssistantServerLogItem {
  public count: number;
  public exception: string;
  public first_occurred: number;
  public level: "ERROR" | "WARNING";
  public message: string[];
  public name: string;
  public source: [string, number];
  public timestamp: number;
}
