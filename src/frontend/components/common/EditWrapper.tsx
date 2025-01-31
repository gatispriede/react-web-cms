import {Box, Button} from "@chakra-ui/react";
import {Delete} from "@styled-icons/typicons/Delete"
import {Edit} from "@styled-icons/fluentui-system-regular/Edit"

const EditWrapper = ({children}) => {
    return (
        <>
            <div className={'edit-button-container'}>
                <Button variant="subtle">
                    <Edit />
                </Button>
            </div>
            {
                children && <Box width={'100%'}>{children}</Box>
            }
            <Box className={'edit-button-container'}>
                <Button onClick={(e) => {
                    console.log(e,'click')}} variant="subtle">
                    <Delete   />
                </Button>
            </Box>
        </>
    )
}
export default EditWrapper