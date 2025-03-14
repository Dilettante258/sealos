import { obj2Query } from '@/api/tools';
import MyIcon from '@/components/Icon';
import PriceBox from '@/components/PriceBox';
import QuotaBox from '@/components/QuotaBox';
import Tip from '@/components/Tip';
import {
  BackupSupportedDBTypeList,
  DBComponents,
  DBTypeEnum,
  DBTypeList,
  RedisHAConfig,
  SelectTimeList,
  WeekSelectList
} from '@/constants/db';
import { CpuSlideMarkList, MemorySlideMarkList } from '@/constants/editApp';
import useEnvStore from '@/store/env';
import { DBVersionMap, INSTALL_ACCOUNT } from '@/store/static';
import type { QueryType } from '@/types';
import { AutoBackupType } from '@/types/backup';
import type { DBComponentsName, DBEditType, DBType, ResourceType } from '@/types/db';
import { I18nCommonKey } from '@/types/i18next';
import { InfoOutlineIcon } from '@chakra-ui/icons';
import {
  Box,
  Center,
  Checkbox,
  Flex,
  FormControl,
  Grid,
  Image,
  Input,
  NumberDecrementStepper,
  NumberIncrementStepper,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  Switch,
  Text,
  useTheme
} from '@chakra-ui/react';
import { MySelect, MySlider, MyTooltip, RangeInput, Tabs } from '@sealos/ui';
import { get, sum, throttle } from 'lodash';
import { useTranslation } from 'next-i18next';
import { useRouter } from 'next/router';
import { memo, useEffect, useMemo, useState } from 'react';
import { useFieldArray, UseFormReturn } from 'react-hook-form';
import { useFormStateStore } from '..';

const BasicResources = {
  cpu: 1000,
  memory: 1024,
  storage: 3,
  replicas: 1
};

const Form = ({
  formHook,
  pxVal,
  minStorage
}: {
  formHook: UseFormReturn<DBEditType, any>;
  pxVal: number;
  minStorage: Partial<Record<DBComponentsName, number>>;
}) => {
  if (!formHook) return null;
  const { t } = useTranslation();
  const { SystemEnv } = useEnvStore();
  const router = useRouter();
  const { name: name_ } = router.query as QueryType;
  const theme = useTheme();
  const isEdit = useMemo(() => !!name_, [name_]);
  const {
    register,
    setValue,
    getValues,
    formState: { errors }
  } = formHook;

  const navList: { id: string; label: I18nCommonKey; icon: string }[] = [
    {
      id: 'baseInfo',
      label: 'basic',
      icon: 'formInfo'
    },
    {
      id: 'backupSettings',
      label: 'backup_settings',
      icon: 'backupSettings'
    }
  ];

  //TODO: backup

  const [activeNav, setActiveNav] = useState(navList[0].id);

  // listen scroll and set activeNav
  useEffect(() => {
    const scrollFn = throttle((e: Event) => {
      if (!e.target) return;
      const doms = navList.map((item) => ({
        dom: document.getElementById(item.id),
        id: item.id
      }));

      const dom = e.target as HTMLDivElement;
      const scrollTop = dom.scrollTop;

      for (let i = doms.length - 1; i >= 0; i--) {
        const offsetTop = doms[i].dom?.offsetTop || 0;
        if (scrollTop + 200 >= offsetTop) {
          setActiveNav(doms[i].id);
          break;
        }
      }
    }, 200);
    document.getElementById('form-container')?.addEventListener('scroll', scrollFn);
    return () => {
      document.getElementById('form-container')?.removeEventListener('scroll', scrollFn);
    };
    // eslint-disable-next-line
  }, []);

  const { selectComponent, setSelectComponent, validFieldIndexs, setValidFieldIndexs } =
    useFormStateStore();

  function handleChangeDbType(id: DBType) {
    setValue('dbType', id);
    setValue('dbVersion', DBVersionMap[getValues('dbType')][0].id);
    const temp = getValues('resources').map((item) => item.name);
    const lackComp = DBComponents[id].filter((item) => !temp.includes(item));

    if (lackComp.length > 0) {
      append(
        lackComp.map((item) => {
          return {
            name: item as DBComponentsName,
            ...BasicResources
          };
        })
      );
    }
    const ValidIndexs = fields
      .map((item, index) => {
        return { value: item, index: index };
      })
      .filter(({ value }) => DBComponents[getValues('dbType')].includes(value.name))
      .map((item) => item.index);
    setSelectComponent(DBComponents[id][0] as DBComponentsName);
    setValidFieldIndexs(ValidIndexs);
  }

  const { control } = formHook;
  const { fields, append } = useFieldArray({
    control,
    name: 'resources'
  });

  function sumNumber(name: keyof Exclude<ResourceType, 'name'>) {
    return sum(validFieldIndexs.map((index: number) => getValues(`resources.${index}.${name}`)));
  }

  const Label = ({
    children,
    w = 'auto',
    ...props
  }: {
    children: string;
    w?: number | 'auto';
    [key: string]: any;
  }) => (
    <Box
      flex={`0 0 ${w === 'auto' ? 'auto' : `${w}px`}`}
      color={'grayModern.900'}
      fontWeight={'bold'}
      userSelect={'none'}
      {...props}
    >
      {children}
    </Box>
  );

  const boxStyles = {
    border: theme.borders.base,
    borderRadius: 'lg',
    mb: 4,
    bg: 'white'
  };

  const headerStyles = {
    py: 4,
    pl: '42px',
    borderTopRadius: 'lg',
    fontSize: 'xl',
    color: 'grayModern.900',
    fontWeight: 'bold',
    display: 'flex',
    alignItems: 'center',
    backgroundColor: 'grayModern.50'
  };

  const index = useMemo(() => {
    console.log(111);
    return fields.findIndex((item) => item.name === selectComponent);
  }, [fields, selectComponent]);

  function ResourceControl({ componentName }: { componentName: DBComponentsName }) {
    console.log('render!');

    function storageHadError() {
      return Boolean(errors?.resources?.[index]?.storage?.message);
    }

    return (
      <>
        <Flex mb={10} pr={3} alignItems={'flex-start'}>
          <Label w={100}>CPU</Label>
          <MySlider
            markList={CpuSlideMarkList}
            activeVal={getValues(`resources.${index}.cpu`)}
            setVal={(e) => {
              setValue(`resources.${index}.cpu`, CpuSlideMarkList[e].value);
            }}
            max={CpuSlideMarkList.length - 1}
            min={0}
            step={1}
          />
          <Box ml={5} transform={'translateY(10px)'} color={'grayModern.600'}>
            (Core)
          </Box>
        </Flex>
        <Flex mb={'50px'} pr={3} alignItems={'center'}>
          <Label w={100}>{t('memory')}</Label>
          <MySlider
            markList={MemorySlideMarkList}
            activeVal={getValues(`resources.${index}.memory`)}
            setVal={(e) => {
              setValue(`resources.${index}.memory`, MemorySlideMarkList[e].value);
            }}
            max={MemorySlideMarkList.length - 1}
            min={0}
            step={1}
          />
        </Flex>
        <Flex mb={8} alignItems={'center'}>
          <Label w={100}>{t('Replicas')}</Label>
          <RangeInput
            w={180}
            value={getValues(`resources.${index}.replicas`)}
            min={1}
            max={20}
            step={
              getValues('dbType') === DBTypeEnum.mongodb || getValues('dbType') === DBTypeEnum.mysql
                ? 2
                : 1
            }
            setVal={(val) => {
              register(`resources.${index}.replicas`, {
                required: t('replicas_cannot_empty'),
                min: {
                  value: 1,
                  message: `${t('min_replicas')}1`
                },
                max: {
                  value: 20,
                  message: `${t('max_replicas')}20`
                }
              });
              const dbType = getValues('dbType');
              const oddVal = val % 2 === 0 ? val + 1 : val;
              const replicasValue =
                dbType === DBTypeEnum.mongodb || dbType === DBTypeEnum.mysql ? oddVal : val;
              setValue(`resources.${index}.replicas`, isNaN(replicasValue) ? 1 : replicasValue);
            }}
          />

          {getValues(`resources.${index}.replicas`) === 1 && (
            <Tip
              ml={4}
              icon={<MyIcon name="warningInfo" width={'14px'}></MyIcon>}
              text={t('single_node_tip')}
              size="sm"
              borderRadius={'md'}
            />
          )}
          {getValues('dbType') === DBTypeEnum.redis &&
            getValues(`resources.${index}.replicas`) > 1 && (
              <Tip
                ml={4}
                icon={<InfoOutlineIcon />}
                text={t('multi_replica_redis_tip')}
                size="sm"
                borderRadius={'md'}
              />
            )}
          {(getValues('dbType') === DBTypeEnum.mongodb ||
            getValues('dbType') === DBTypeEnum.mysql) &&
            getValues(`resources.${index}.replicas`) > 1 && (
              <Tip
                ml={4}
                icon={<InfoOutlineIcon />}
                text={t('db_instances_tip', {
                  db: getValues('dbType')
                })}
                size="sm"
                borderRadius={'md'}
              />
            )}
        </Flex>

        <FormControl isInvalid={storageHadError()} w={'500px'}>
          <Flex alignItems={'center'}>
            <Label w={100}>{t('storage')}</Label>
            <MyTooltip
              label={`${t('storage_range')}${minStorage[componentName]}~${
                SystemEnv.STORAGE_MAX_SIZE
              } Gi`}
            >
              <NumberInput
                w={'180px'}
                max={SystemEnv.STORAGE_MAX_SIZE}
                min={minStorage[componentName]}
                step={1}
                position={'relative'}
                value={getValues(`resources.${index}.storage`)}
                onChange={(e) => {
                  console.log(fields);
                  e !== ''
                    ? setValue(`resources.${index}.storage`, +e)
                    : setValue(`resources.${index}.storage`, minStorage?.[componentName] ?? 1);
                }}
              >
                <NumberInputField
                  {...register(`resources.${index}.storage`, {
                    required: t('storage_cannot_empty'),
                    min: {
                      value: minStorage?.[componentName] ?? 1,
                      message: `${t('storage_min')}${minStorage[componentName]} Gi`
                    },
                    max: {
                      value: SystemEnv.STORAGE_MAX_SIZE,
                      message: `${t('storage_max')}${SystemEnv.STORAGE_MAX_SIZE} Gi`
                    },
                    valueAsNumber: true
                  })}
                  min={minStorage[componentName]}
                  max={SystemEnv.STORAGE_MAX_SIZE}
                  borderRadius={'md'}
                  borderColor={'#E8EBF0'}
                  bg={'#F7F8FA'}
                  _focusVisible={{
                    borderColor: 'brightBlue.500',
                    boxShadow: '0px 0px 0px 2.4px rgba(33, 155, 244, 0.15)',
                    bg: '#FFF',
                    color: '#111824'
                  }}
                  _hover={{
                    borderColor: 'brightBlue.300'
                  }}
                />
                <NumberInputStepper>
                  <NumberIncrementStepper>
                    <MyIcon name="arrowUp" width={'12px'} />
                  </NumberIncrementStepper>
                  <NumberDecrementStepper>
                    <MyIcon name="arrowDown" width={'12px'} />
                  </NumberDecrementStepper>
                </NumberInputStepper>
                <Box
                  zIndex={1}
                  position={'absolute'}
                  right={10}
                  top={'50%'}
                  transform={'translateY(-50%)'}
                  color={'grayModern.600'}
                >
                  Gi
                </Box>
              </NumberInput>
            </MyTooltip>
          </Flex>
        </FormControl>
      </>
    );
  }

  const MemoResourceControl = memo(ResourceControl);

  return (
    <>
      <Grid
        height={'100%'}
        templateColumns={'220px 1fr'}
        gridGap={5}
        alignItems={'start'}
        pl={`${pxVal}px`}
      >
        <Box>
          <Tabs
            list={[
              { id: 'form', label: t('config_form') },
              { id: 'yaml', label: t('yaml_file') }
            ]}
            activeId={'form'}
            onChange={() =>
              router.replace(
                `/db/edit?${obj2Query({
                  name: name_,
                  type: 'yaml'
                })}`
              )
            }
          />
          <Box
            mt={3}
            borderRadius={'md'}
            overflow={'hidden'}
            backgroundColor={'white'}
            border={theme.borders.base}
            p={'4px'}
          >
            {navList.map((item) => (
              <Box key={item.id} onClick={() => router.replace(`#${item.id}`)}>
                <Flex
                  borderRadius={'base'}
                  cursor={'pointer'}
                  gap={'8px'}
                  alignItems={'center'}
                  h={'40px'}
                  _hover={{
                    backgroundColor: 'grayModern.100'
                  }}
                  color="grayModern.900"
                  backgroundColor={activeNav === item.id ? 'grayModern.100' : 'transparent'}
                  fontWeight={500}
                >
                  <Box
                    w={'2px'}
                    h={'24px'}
                    justifySelf={'start'}
                    bg={'grayModern.900'}
                    borderRadius={'12px'}
                    opacity={activeNav === item.id ? 1 : 0}
                  />
                  <MyIcon
                    name={item.icon as any}
                    w={'20px'}
                    h={'20px'}
                    color={activeNav === item.id ? 'grayModern.900' : 'grayModern.500'}
                  />
                  <Box>{t(item.label)}</Box>
                </Flex>
              </Box>
            ))}
          </Box>
          <Box mt={3} overflow={'hidden'}>
            <QuotaBox />
          </Box>
          {INSTALL_ACCOUNT && (
            <Box mt={3} overflow={'hidden'}>
              <PriceBox
                components={[
                  {
                    cpu: sumNumber('cpu'),
                    memory: sumNumber('memory'),
                    storage: sumNumber('storage'),
                    replicas: [sumNumber('replicas') || 1, sumNumber('replicas') || 1]
                  },

                  // TODO:
                  ...(getValues('dbType') === DBTypeEnum.redis
                    ? (() => {
                        const config = RedisHAConfig(sumNumber('replicas') > 1);
                        return [
                          {
                            ...config,
                            replicas: [config.replicas, config.replicas]
                          }
                        ];
                      })()
                    : [])
                ]}
              />
            </Box>
          )}
        </Box>
        <Box
          id={'form-container'}
          pr={`${pxVal}px`}
          height={'100%'}
          position={'relative'}
          overflowY={'scroll'}
        >
          {/* base info */}
          <Box id={'baseInfo'} {...boxStyles}>
            <Box {...headerStyles}>
              <MyIcon name={'formInfo'} mr={5} w={'20px'} color={'grayModern.600'} />
              {t('basic')}
            </Box>
            <Box px={'42px'} py={'24px'}>
              <Flex alignItems={'center'} mb={7}>
                <Label w={100} alignSelf={'flex-start'}>
                  {t('Type')}
                </Label>
                <Flex flexWrap={'wrap'} gap={'12px'}>
                  {DBTypeList &&
                    DBTypeList?.map((item) => {
                      return (
                        <Center
                          key={item.id}
                          flexDirection={'column'}
                          w={'110px'}
                          height={'80px'}
                          border={'1px solid'}
                          borderRadius={'6px'}
                          cursor={isEdit ? 'not-allowed' : 'pointer'}
                          opacity={isEdit && getValues('dbType') !== item.id ? '0.4' : '1'}
                          fontWeight={'bold'}
                          color={'grayModern.900'}
                          {...(getValues('dbType') === item.id
                            ? {
                                bg: '#F9FDFE',
                                borderColor: 'brightBlue.500',
                                boxShadow: '0px 0px 0px 2.4px rgba(33, 155, 244, 0.15)'
                              }
                            : {
                                bg: '#F7F8FA',
                                borderColor: 'grayModern.200',
                                _hover: {
                                  borderColor: '#85ccff'
                                }
                              })}
                          onClick={() => {
                            if (isEdit) return;
                            handleChangeDbType(item.id);
                          }}
                        >
                          <Image
                            width={'32px'}
                            height={'32px'}
                            alt={item.id}
                            src={`/images/${item.id}.svg`}
                          />
                          <Text
                            _firstLetter={{
                              textTransform: 'capitalize'
                            }}
                            mt={'4px'}
                            textAlign={'center'}
                          >
                            {item.label}
                          </Text>
                        </Center>
                      );
                    })}
                </Flex>
              </Flex>
              <Flex alignItems={'center'} mb={7}>
                <Label w={100}>{t('version')}</Label>

                <MySelect
                  isDisabled={isEdit}
                  width={'200px'}
                  placeholder={`${t('DataBase')} ${t('version')}`}
                  value={getValues('dbVersion')}
                  list={DBVersionMap[getValues('dbType')].map((i) => ({
                    label: i.label,
                    value: i.id
                  }))}
                  onchange={(val: any) => setValue('dbVersion', val)}
                />
              </Flex>
              <FormControl mb={7} isInvalid={!!errors.dbName} w={'500px'}>
                <Flex alignItems={'center'}>
                  <Label w={100}>{t('name')}</Label>
                  <Input
                    disabled={isEdit}
                    title={isEdit ? t('cannot_change_name') : ''}
                    autoFocus={true}
                    placeholder={t('database_name_regex')}
                    {...register('dbName', {
                      required: t('database_name_empty'),
                      pattern: {
                        value: /^[a-z]([-a-z0-9]*[a-z0-9])?$/g,
                        message: t('database_name_regex_error')
                      },
                      maxLength: {
                        value: 30,
                        message: t('database_name_max_length', { length: 30 })
                      }
                    })}
                  />
                </Flex>
              </FormControl>
              <Flex alignItems={'center'} mb={7}>
                <Label w={100}>{t('component')}</Label>
                <Tabs
                  w={`${DBComponents[getValues('dbType')].length * 100}px`}
                  list={DBComponents[getValues('dbType')].map((item) => ({
                    label: item,
                    id: item
                  }))}
                  activeId={selectComponent}
                  size={'sm'}
                  borderColor={'myGray.200'}
                  onChange={(e) => {
                    setSelectComponent(e as DBComponentsName);
                  }}
                />
              </Flex>
              {/* {
              } */}
              <MemoResourceControl componentName={selectComponent} />
              {JSON.stringify(fields)}
            </Box>
          </Box>
          {BackupSupportedDBTypeList.includes(getValues('dbType')) && (
            <Box id={'backupSettings'} {...boxStyles}>
              <Box {...headerStyles}>
                <MyIcon name={'backupSettings'} mr={5} w={'20px'} color={'grayModern.600'} />
                {t('backup_settings')}
                <Switch
                  ml={'20px'}
                  isChecked={getValues('autoBackup.start')}
                  onChange={(e) => {
                    setValue('autoBackup.start', e.target.checked);
                  }}
                />
              </Box>
              <Box display={getValues('autoBackup.start') ? 'block' : 'none'}>
                <Box px={'42px'} py={'24px'} flex={1} userSelect={'none'}>
                  <Flex alignItems={'center'}>
                    <Box flex={'0 0 110px'}>{t('CronExpression')}</Box>
                    <Tabs
                      w={'220px'}
                      list={[
                        { id: 'hour', label: t('Hour') },
                        { id: 'day', label: t('Day') },
                        { id: 'week', label: t('Week') }
                      ]}
                      activeId={getValues('autoBackup.type')}
                      size={'sm'}
                      borderColor={'myGray.200'}
                      onChange={(e) => {
                        setValue('autoBackup.type', e as AutoBackupType);
                      }}
                    />
                  </Flex>
                  {getValues('autoBackup.type') === 'week' && (
                    <Flex mt={4}>
                      <Box flex={'0 0 110px'} />
                      {WeekSelectList.map((item) => (
                        <Box key={item.id} _notLast={{ mr: 4 }}>
                          <Checkbox
                            defaultChecked={getValues('autoBackup.week').includes(item.id)}
                            onChange={(e) => {
                              const val = e.target.checked;
                              const checkedList = [...getValues('autoBackup.week')];
                              const index = checkedList.findIndex((week) => week === item.id);
                              if (val && index === -1) {
                                setValue('autoBackup.week', checkedList.concat(item.id));
                              } else if (!val && index > -1) {
                                checkedList.splice(index, 1);
                                setValue('autoBackup.week', checkedList);
                              }
                            }}
                          >
                            {t(item.label)}
                          </Checkbox>
                        </Box>
                      ))}
                    </Flex>
                  )}
                  <Flex alignItems={'center'} mt={7}>
                    <Box flex={'0 0 110px'}>{t('start_time')}</Box>
                    {getValues('autoBackup.type') !== 'hour' && (
                      <Flex alignItems={'center'}>
                        <MySelect
                          width={'120px'}
                          value={getValues('autoBackup.hour')}
                          list={SelectTimeList.slice(0, 24).map((i) => ({
                            value: i.id,
                            label: i.label
                          }))}
                          onchange={(val: any) => {
                            setValue('autoBackup.hour', val);
                          }}
                        />
                        <Box flex={'0 0 110px'} ml={'8px'} mr={'12px'}>
                          {t('hour')}
                        </Box>
                      </Flex>
                    )}

                    <Flex alignItems={'center'}>
                      <MySelect
                        width={'120px'}
                        value={getValues('autoBackup.minute')}
                        list={SelectTimeList.map((i) => ({
                          value: i.id,
                          label: i.label
                        }))}
                        onchange={(val: any) => {
                          setValue('autoBackup.minute', val);
                        }}
                      />
                      <Box flex={'0 0 110px'} ml={'8px'}>
                        {t('minute')}
                      </Box>
                    </Flex>
                  </Flex>

                  <Flex mt={7} alignItems={'center'}>
                    <Box flex={'0 0 110px'}>{t('SaveTime')}</Box>
                    <Input
                      height={'35px'}
                      maxW={'100px'}
                      bg={'#F7F8FA'}
                      borderTopRightRadius={0}
                      borderBottomRightRadius={0}
                      _focus={{
                        boxShadow: 'none',
                        borderColor: 'myGray.200',
                        bg: 'white'
                      }}
                      {...register('autoBackup.saveTime', {
                        min: 1,
                        valueAsNumber: true
                      })}
                    />
                    <MySelect
                      width={'80px'}
                      value={getValues('autoBackup.saveType').toString()}
                      borderLeft={0}
                      boxShadow={'none !important'}
                      borderColor={'myGray.200'}
                      list={[
                        { value: 'd', label: t('Day') },
                        { value: 'h', label: t('Hour') }
                      ]}
                      h={'35px'}
                      borderTopLeftRadius={0}
                      borderBottomLeftRadius={0}
                      onchange={(val: any) => {
                        setValue('autoBackup.saveType', val);
                      }}
                    />
                  </Flex>
                  <Flex mt={7} alignItems={'start'}>
                    <Box flex={'0 0 110px'}>{t('termination_policy')}</Box>
                    {/* <Switch
                      isChecked={getValues('terminationPolicy') === 'Delete'}
                      onChange={(e) => {
                        setValue('terminationPolicy', e.target.checked ? 'Delete' : 'WipeOut');
                      }}
                    /> */}
                    <Flex gap={'12px'} flexDirection={'column'}>
                      {['Delete', 'WipeOut'].map((item) => {
                        const isChecked = getValues('terminationPolicy') === item;

                        return (
                          <Flex
                            key={item}
                            alignItems={'center'}
                            justifyContent={'start'}
                            minW={'300px'}
                            p={'10px 12px'}
                            gap={'8px'}
                            bg={'grayModern.50'}
                            border={'1px solid'}
                            boxShadow={
                              isChecked ? '0px 0px 0px 2.4px rgba(33, 155, 244, 0.15)' : 'none'
                            }
                            borderColor={isChecked ? 'brightBlue.500' : '#E8EBF0'}
                            borderRadius={'md'}
                            onClick={() => {
                              setValue(
                                'terminationPolicy',
                                getValues('terminationPolicy') === 'Delete' ? 'WipeOut' : 'Delete'
                              );
                            }}
                            cursor={'pointer'}
                          >
                            <Center
                              boxSize={'14px'}
                              borderRadius={'full'}
                              border={'1px solid'}
                              borderColor={isChecked ? 'brightBlue.500' : '#E8EBF0'}
                              boxShadow={
                                isChecked ? '0px 0px 0px 2.4px rgba(33, 155, 244, 0.15)' : '#C4CBD7'
                              }
                            >
                              {isChecked && (
                                <Box boxSize={'4px'} borderRadius={'full'} bg={'#219BF4'}></Box>
                              )}
                            </Center>
                            <Box>
                              <Text fontSize={'12px'} fontWeight={'bold'} color={'grayModern.900'}>
                                {t(`${item.toLowerCase()}_backup_with_db` as I18nCommonKey)}
                              </Text>
                              <Text fontSize={'10px'} fontWeight={'bold'} color="grayModern.500">
                                {t(`${item.toLowerCase()}_backup_with_db_tip` as I18nCommonKey)}
                              </Text>
                            </Box>
                          </Flex>
                        );
                      })}
                    </Flex>
                  </Flex>
                </Box>
              </Box>
            </Box>
          )}
        </Box>
      </Grid>
    </>
  );
};

export default Form;
