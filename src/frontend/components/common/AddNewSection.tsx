import {
    Button,
    createListCollection,
    SelectContent, SelectItem,
    SelectLabel,
    SelectRoot,
    SelectTrigger,
    SelectValueText
} from "@chakra-ui/react"
import {
    DialogActionTrigger,
    DialogBody,
    DialogCloseTrigger,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogRoot,
    DialogTitle,
    DialogTrigger,
} from "../ui/dialog"
import {PlusSquareDotted} from "@styled-icons/bootstrap/PlusSquareDotted"
import React from "react";

class AddNewSection extends React.Component {
    private _type: string = ''
    state = {
        fieldTypes: createListCollection({
            items: [
                { label: "100%", value: "1" },
                { label: "50% 50%", value: "2" },
                { label: "30% 30% 30%", value: "3" },
                { label: "25% 25% 25% 25%", value: "4" },
            ],
        })
    }
    constructor(props) {
        super(props)
    }

    get type():string {
        return this._type
    }
    set type(type: string) {
        this._type = type
    }
    render() {
        return (
            <DialogRoot>
                <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                        <PlusSquareDotted />
                    </Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add section</DialogTitle>
                    </DialogHeader>
                    <DialogBody>
                        <SelectRoot collection={this.state.fieldTypes} size="sm" width="320px">
                            <SelectLabel>Select type</SelectLabel>
                            <SelectTrigger>
                                <SelectValueText placeholder="Select item type" />
                            </SelectTrigger>
                            <SelectContent onChange={(value: string) => this._type = value}>
                                {this.state.fieldTypes.items.map((item) => (
                                    <SelectItem item={item} key={item.value}>
                                        {item.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </SelectRoot>
                        <div>Selected: {this.type}</div>
                    </DialogBody>
                    <DialogFooter>
                        <DialogActionTrigger asChild>
                            <Button variant="outline">Cancel</Button>
                        </DialogActionTrigger>
                        <DialogActionTrigger asChild>
                            <Button>Save</Button>
                        </DialogActionTrigger>
                    </DialogFooter>
                    <DialogCloseTrigger />
                </DialogContent>
            </DialogRoot>
        )
    }
}

export default AddNewSection