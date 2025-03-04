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
      <Button>Connect</Button>
    </DialogTrigger>
    <DialogContent className="sm:max-w-[425px]">
      <DialogHeader>
        <DialogTitle>Pick a wallet</DialogTitle>
      </DialogHeader>
      <div className="flex justify-center gap-4">
        <Button variant="ghost" className="h-full max-w-20 flex-col" onClick={() => setActiveConnectorType(BROWSER_WALLET)} >
          <img src="/images/concordium-wallet-logo.png" alt="" />
          <p className="text-wrap">Concordium Wallet</p>
        </Button>
        <Button variant="ghost"  className="h-full max-w-20 flex-col" onClick={() => setActiveConnectorType(WALLETCONNECT_WALLET)}>
          <img  src="/images/walletconnect-logo.png" alt="" />
          <p className="text-wrap">Wallet Connect</p>
        </Button>
      </div>
    </DialogContent>
  </Dialog>)
}