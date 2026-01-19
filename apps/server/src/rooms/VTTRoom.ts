import { Room, Client } from "colyseus";

type VttState = {
  clients: number;
};

export class VTTRoom extends Room<VttState> {
  onCreate() {
    this.setState({ clients: 0 });
    console.log("VTT room created");
  }

  onJoin(_client: Client) {
    this.state.clients += 1;
    console.log("Client joined VTT room");
  }

  onLeave(_client: Client) {
    this.state.clients = Math.max(0, this.state.clients - 1);
    console.log("Client left VTT room");
  }
}
