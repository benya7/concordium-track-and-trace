import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ConnectorType } from "@concordium/react-components";
import { BROWSER_WALLET, WALLETCONNECT_WALLET } from "@/constants";

interface Props {
  setActiveConnectorType: (type: ConnectorType | undefined) => void;
}

export function WalletConnectorDialog({setActiveConnectorType}: Props) {
  
  return (<Dialog>
    <DialogTrigger asChild>
      <Button variant="outline">Connect</Button>
    </DialogTrigger>
    <DialogContent className="sm:max-w-[425px]">
      <DialogHeader>
        <DialogTitle>Pick a wallet</DialogTitle>
      </DialogHeader>
      <div className="grid gap-4 py-4">
        <Button onClick={() => setActiveConnectorType(BROWSER_WALLET)}>
          <img src="/images/concordium-wallet-logo.png" alt="" />
          Concordium Browser Wallet
        </Button>
        <Button onClick={() => setActiveConnectorType(WALLETCONNECT_WALLET)}>
          <img src="/images/connectwallet-logo.png" alt="" />
          Wallet Connect
        </Button>
      </div>
    </DialogContent>
  </Dialog>)
}